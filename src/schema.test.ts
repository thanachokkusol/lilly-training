import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite(),
  owner = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  trainer = "00000000-0000-4000-8000-000000000003",
  stranger = "00000000-0000-4000-8000-000000000004";
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id text primary key,bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,update on storage.objects to authenticated; create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$; insert into auth.users values ('${owner}'),('${other}'); alter default privileges in schema public grant execute on functions to anon, authenticated;`,
  );
  await db.exec(readFileSync("supabase/schema.sql", "utf-8"));
  await db.exec(`insert into public.training_owners values ('${owner}');`);
}, 60000);
afterAll(() => db.close());
const identity = async (id: string) =>
  db.exec(`reset role;set app.uid='${id}';set role authenticated;`);
describe.sequential("database access controls and optimistic writes", () => {
  it("rejects writes by a signed-in non-owner", async () => {
    await identity(other);
    await expect(
      db.query(
        `select * from public.save_training_record('test','body','{"weight":70}',0,false)`,
      ),
    ).rejects.toThrow("Unauthorized");
  });
  it("owner can insert and revision guards prevent lost updates", async () => {
    await identity(owner);
    const saved = await db.query<any>(
      `select * from public.save_training_record('test','body','{"weight":70}',0,false)`,
    );
    expect(saved.rows[0].saved).toBe(true);
    expect(Number(saved.rows[0].version)).toBe(1);
    const conflict = await db.query<any>(
      `select * from public.save_training_record('test','body','{"weight":80}',0,false)`,
    );
    expect(conflict.rows[0].saved).toBe(false);
    expect(conflict.rows[0].payload.weight).toBe(70);
    const update = await db.query<any>(
      `select * from public.save_training_record('test','body','{"weight":71}',1,false)`,
    );
    expect(update.rows[0].saved).toBe(true);
    expect(Number(update.rows[0].version)).toBe(2);
  });
  it("other authenticated users cannot read owner records or write tables directly", async () => {
    await identity(other);
    expect(
      (await db.query("select * from public.training_records")).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(
        `insert into public.training_records(user_id,id,kind,payload) values ('${other}','bypass','body','{}')`,
      ),
    ).rejects.toThrow();
  });
  it("photo policies require owner and user path, bucket is private", async () => {
    await identity(owner);
    await db.exec(
      `insert into storage.objects values ('own','training-photos','${owner}/photo.jpg')`,
    );
    await expect(
      db.exec(
        `insert into storage.objects values ('wrong','training-photos','${other}/photo.jpg')`,
      ),
    ).rejects.toThrow();
    await identity(other);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.exec(
        `insert into storage.objects values ('other','training-photos','${other}/photo.jpg')`,
      ),
    ).rejects.toThrow();
    await db.exec("reset role");
    expect(
      (
        await db.query<any>(
          `select public from storage.buckets where id='training-photos'`,
        )
      ).rows[0].public,
    ).toBe(false);
  });
  it("a linked trainer reads the owner's journal but cannot change it", async () => {
    await db.exec(`reset role;
      insert into auth.users values ('${trainer}'),('${stranger}');
      insert into public.profiles(id,username,display_name,role) values
        ('${trainer}','coachbank','Coach','trainer'),('${stranger}','nolink','No link','trainer');
      insert into public.coach_links(trainer_id,client_id) values ('${trainer}','${owner}');`);
    await identity(owner);
    await db.query(`select * from public.save_training_record('cardio-1','cardio','{"seconds":600}',0,false)`);
    await db.query(`select * from public.save_training_record('we-chest','machine','{"name":"Chest Press"}',0,false)`);
    await identity(trainer);
    expect(
      (await db.query<any>(`select public.journal_role() as r`)).rows[0].r,
    ).toBe("trainer");
    const seen = (await db.query<any>(`select id from public.training_records order by id`)).rows.map((r) => r.id);
    expect(seen).toEqual(["cardio-1", "test", "we-chest"]);
    // Writing the owner's private id only creates the trainer's own record.
    const write = await db.query<any>(
      `select * from public.save_training_record('cardio-1','cardio','{"seconds":1}',0,false)`,
    );
    expect(write.rows[0].saved).toBe(true);
    await db.exec("reset role");
    const owners = await db.query<any>(
      `select payload->>'seconds' s, version from public.training_records where user_id='${owner}' and id='cardio-1'`,
    );
    expect(owners.rows[0]).toEqual({ s: "600", version: 1 });
    await expect(
      (async () => {
        await identity(trainer);
        await db.exec(`update public.training_records set payload='{}' where id='cardio-1'`);
        await db.exec("reset role");
        const r = await db.query<any>(`select payload from public.training_records where user_id='${owner}' and id='cardio-1'`);
        if (r.rows[0].payload.seconds !== 600) throw Error("owner record changed");
      })(),
    ).rejects.toThrow();
  });
  it("trainers edit shared equipment and owners see the change", async () => {
    await identity(trainer);
    const edit = await db.query<any>(
      `select * from public.save_training_record('we-chest','machine','{"name":"Chest Press","setup":"x"}',1,false)`,
    );
    expect(edit.rows[0].saved).toBe(true);
    await identity(owner);
    const row = await db.query<any>(`select payload->>'setup' s, shared from public.training_records where id='we-chest'`);
    expect(row.rows).toEqual([{ s: "x", shared: true }]);
  });
  it("unlinked, revoked and disabled trainers cannot read private records", async () => {
    await identity(stranger);
    expect(
      (await db.query<any>(`select id from public.training_records where id='cardio-1'`)).rows,
    ).toHaveLength(0);
    await db.exec(`reset role; update public.coach_links set status='revoked' where trainer_id='${trainer}';`);
    await identity(trainer);
    expect(
      (await db.query<any>(`select id from public.training_records where user_id='${owner}' and not shared`)).rows,
    ).toHaveLength(0);
    await db.exec(`reset role; update public.coach_links set status='active'; update public.profiles set disabled=true where id='${trainer}';`);
    await identity(trainer);
    expect((await db.query<any>(`select public.is_training_owner() as ok`)).rows[0].ok).toBe(false);
    await expect(
      db.query(`select * from public.save_training_record('z','body','{}',0,false)`),
    ).rejects.toThrow("Unauthorized");
  });
  it("members rename only themselves", async () => {
    await identity(owner);
    await db.query(`select public.set_my_display_name('ธนโชค')`);
    await db.exec("reset role");
    expect(
      (await db.query<any>(`select display_name, role from public.profiles where id='${owner}'`)).rows[0],
    ).toEqual({ display_name: "ธนโชค", role: "owner" });
    await db.exec(`set app.uid='';set role anon;`);
    await expect(db.query(`select public.set_my_display_name('x')`)).rejects.toThrow();
    await db.exec("reset role");
  });
  it("re-running the schema keeps existing records and sharing", async () => {
    await db.exec("reset role");
    await db.exec(readFileSync("supabase/schema.sql", "utf-8"));
    const rows = await db.query<any>(`select id, shared from public.training_records order by user_id, id`);
    expect(rows.rows.filter((r) => r.id === "we-chest")).toEqual([{ id: "we-chest", shared: true }]);
    expect(rows.rows.find((r) => r.id === "test")?.shared).toBe(false);
  });
  it("isolates friends' journals and evidence while keeping the equipment catalog shared", async () => {
    await db.exec(`reset role;
      insert into public.profiles(id,username,role) values ('${other}','friend-test','friend');
      update public.profiles set disabled=false where id='${trainer}';`);
    await identity(other);
    expect((await db.query("select id from public.training_records where not shared")).rows).toHaveLength(0);
    expect((await db.query("select id from storage.objects")).rows).toHaveLength(0);
    await db.query(`select * from public.save_training_record('friend-cardio','cardio','{"seconds":30}',0,false)`);
    await db.query(`select * from public.save_training_record('friend-equipment','machine','{"name":"Row"}',0,false)`);
    await identity(trainer);
    expect((await db.query("select id from public.training_records where id='friend-cardio'")).rows).toHaveLength(0);
    expect((await db.query("select id from public.training_records where id='friend-equipment'")).rows).toHaveLength(1);
    await identity(owner);
    expect((await db.query("select id from public.training_records where id='friend-cardio'")).rows).toHaveLength(1);
  });
  it("shares the legacy Jett machine photo without sharing owner evidence", async () => {
    await identity(owner);
    await db.query(`select * from public.save_training_record('jett-row','machine','{"gym":"Jett","photoId":"photo-jett-ref-row"}',0,false)`);
    await db.query(`select * from public.save_training_record('photo-jett-ref-row','photo','{"label":"legacy Jett"}',0,false)`);
    await db.exec(`insert into storage.objects values ('jett-legacy','training-photos','${owner}/photo-jett-ref-row.jpg')`);
    await identity(other);
    expect((await db.query("select id from storage.objects where id='jett-legacy'")).rows).toHaveLength(0);
    await db.exec("reset role");
    const migration = readFileSync("supabase/migrations/20261125_share_legacy_jett_machine_photos.sql", "utf-8");
    await db.exec(migration);
    await db.exec(migration);
    await identity(other);
    expect((await db.query("select id from storage.objects order by id")).rows).toEqual([{ id: "jett-legacy" }]);
    expect((await db.query("select version from public.training_records where id='photo-jett-ref-row'")).rows)
      .toEqual([{ version: 2 }]);
  });
  it("unauthenticated clients have no table access or save function access", async () => {
    await db.exec(`reset role;set app.uid='';set role anon;`);
    await expect(
      db.exec("select public.is_training_owner()"),
    ).rejects.toThrow();
    await expect(
      db.exec("select * from public.training_records"),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `select * from public.save_training_record('x','body','{}',0,false)`,
      ),
    ).rejects.toThrow();
  });
});
