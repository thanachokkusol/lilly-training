import { describe, it, expect } from "vitest";
import { handleSignup } from "../supabase/functions/member-signup/index";

type Profile = { id: string; username: string; display_name: string; role: string; created_at: string };

/** Minimal in-memory stand-in for the parts of the Supabase admin client the function uses. */
function fakeAdmin(opts: {
  settings?: { enabled: boolean; invite_code: string | null } | null;
  profiles?: Profile[];
  failProfileInsert?: boolean;
}) {
  const state = {
    settings: opts.settings ?? null,
    profiles: [...(opts.profiles ?? [])],
    users: [] as { id: string; email: string; password: string }[],
    deleted: [] as string[],
  };
  const query = (table: string) => {
    const filters: [string, string, unknown][] = [];
    let countMode = false;
    const rows = () => {
      if (table === "signup_settings") return state.settings ? [state.settings] : [];
      return state.profiles.filter((p) =>
        filters.every(([op, col, v]) =>
          op === "eq" ? (p as any)[col] === v : String((p as any)[col]) >= String(v),
        ),
      );
    };
    const builder: any = {
      select(_cols: string, o?: { count?: string }) {
        countMode = !!o?.count;
        return builder;
      },
      eq(col: string, v: unknown) {
        filters.push(["eq", col, v]);
        return builder;
      },
      gte(col: string, v: unknown) {
        filters.push(["gte", col, v]);
        return builder;
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then(resolve: (v: unknown) => void) {
        resolve(countMode ? { count: rows().length, error: null } : { data: rows(), error: null });
      },
      insert: async (row: Profile) => {
        if (opts.failProfileInsert) return { error: { message: "insert failed" } };
        state.profiles.push({ ...row, created_at: new Date().toISOString() });
        return { error: null };
      },
    };
    return builder;
  };
  const admin = {
    from: query,
    auth: {
      admin: {
        createUser: async ({ email, password }: { email: string; password: string }) => {
          if (state.users.some((u) => u.email === email))
            return { data: { user: null }, error: { message: "User already registered" } };
          const user = { id: `user-${state.users.length + 1}`, email, password };
          state.users.push(user);
          return { data: { user }, error: null };
        },
        deleteUser: async (id: string) => {
          state.deleted.push(id);
          state.users = state.users.filter((u) => u.id !== id);
          return { error: null };
        },
      },
    },
  };
  return { admin, state };
}
const open = { enabled: true, invite_code: "LILLY-AB12-CD34" };
const good = { inviteCode: "LILLY-AB12-CD34", username: "Mint.Run", displayName: "มิ้นท์", password: "longenough1" };
const call = async (admin: unknown, body: unknown, method = "POST") => {
  const res = await handleSignup(
    new Request("https://x/functions/v1/member-signup", {
      method,
      body: method === "POST" ? JSON.stringify(body) : undefined,
    }),
    admin,
  );
  return { status: res.status, body: res.status === 200 && method === "OPTIONS" ? null : await res.json().catch(() => null) };
};

describe("member-signup", () => {
  it("creates a friend account with the right invite code", async () => {
    const { admin, state } = fakeAdmin({ settings: open });
    const r = await call(admin, good);
    expect(r).toEqual({ status: 200, body: { ok: true, username: "mint.run" } });
    expect(state.users).toEqual([{ id: "user-1", email: "mint.run@lilly.local", password: "longenough1" }]);
    expect(state.profiles).toMatchObject([{ id: "user-1", username: "mint.run", display_name: "มิ้นท์", role: "friend" }]);
  });
  it("never creates coach or owner accounts, whatever the request says", async () => {
    const { admin, state } = fakeAdmin({ settings: open });
    await call(admin, { ...good, role: "owner" });
    expect(state.profiles[0].role).toBe("friend");
  });
  it("rejects when sign-up is closed, unset, or the code is wrong, with the same message", async () => {
    for (const settings of [null, { enabled: false, invite_code: "LILLY-AB12-CD34" }, { enabled: true, invite_code: null }]) {
      const { admin, state } = fakeAdmin({ settings });
      const r = await call(admin, good);
      expect(r.status).toBe(403);
      expect(state.users).toHaveLength(0);
    }
    const { admin } = fakeAdmin({ settings: open });
    const wrong = await call(admin, { ...good, inviteCode: "LILLY-AB12-CD35" });
    expect(wrong).toEqual({ status: 403, body: { error: "รหัสเชิญไม่ถูกต้อง หรือยังไม่เปิดรับสมัคร" } });
  });
  it("validates name, username and password before creating anything", async () => {
    const cases = [
      [{ ...good, displayName: "  " }, "กรอกชื่อที่แสดง"],
      [{ ...good, username: "ab" }, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–32 ตัว"],
      [{ ...good, username: "bad name!" }, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–32 ตัว"],
      [{ ...good, password: "short" }, "รหัสผ่านต้องยาว 8–72 ตัวอักษร"],
      [{ ...good, password: "x".repeat(73) }, "รหัสผ่านต้องยาว 8–72 ตัวอักษร"],
    ] as const;
    for (const [body, message] of cases) {
      const { admin, state } = fakeAdmin({ settings: open });
      expect(await call(admin, body)).toEqual({ status: 400, body: { error: message } });
      expect(state.users).toHaveLength(0);
    }
  });
  it("refuses a username that is already taken", async () => {
    const { admin, state } = fakeAdmin({
      settings: open,
      profiles: [{ id: "u0", username: "mint.run", display_name: "x", role: "friend", created_at: "2000-01-01T00:00:00Z" }],
    });
    expect(await call(admin, good)).toEqual({ status: 400, body: { error: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" } });
    expect(state.users).toHaveLength(0);
  });
  it("slows down after 20 sign-ups within an hour", async () => {
    const recent = new Date().toISOString();
    const profiles = Array.from({ length: 20 }, (_, i) => ({
      id: `f${i}`, username: `f${i}x`, display_name: "x", role: "friend", created_at: recent,
    }));
    const { admin, state } = fakeAdmin({ settings: open, profiles });
    expect((await call(admin, good)).status).toBe(429);
    expect(state.users).toHaveLength(0);
  });
  it("removes the login again if the profile cannot be saved", async () => {
    const { admin, state } = fakeAdmin({ settings: open, failProfileInsert: true });
    expect((await call(admin, good)).status).toBe(500);
    expect(state.deleted).toEqual(["user-1"]);
    expect(state.users).toHaveLength(0);
  });
  it("answers CORS preflight and rejects other methods", async () => {
    const { admin } = fakeAdmin({ settings: open });
    expect((await call(admin, null, "OPTIONS")).status).toBe(200);
    expect((await call(admin, null, "GET")).status).toBe(405);
  });
});
