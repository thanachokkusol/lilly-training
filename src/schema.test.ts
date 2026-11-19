import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite(),
  owner = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
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
