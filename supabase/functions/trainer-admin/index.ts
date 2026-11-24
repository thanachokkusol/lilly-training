// Supabase Edge Function: trainer-admin
// Owner-only management of trainer accounts. The service role key is read from the
// function's own environment and never reaches the browser.
// Deploy with "Verify JWT" off: the caller is verified below with their own access token.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (message: string, status = 400) => json({ error: message }, status);

const USERNAME = /^[a-z0-9._-]{3,32}$/;
const emailFor = (username: string) => `${username}@lilly.local`;
const validPassword = (p: unknown): p is string => typeof p === "string" && p.length >= 8 && p.length <= 72;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  // Projects on the new key system expose secret keys as JSON; older ones as SERVICE_ROLE_KEY.
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    (Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"))[0] as string | undefined);
  if (!service) return fail("ฟังก์ชันยังไม่มีคีย์ของระบบ", 500);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("ต้องเข้าสู่ระบบ", 401);
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return fail("ต้องเข้าสู่ระบบ", 401);
  const { data: owner } = await admin.from("training_owners").select("user_id").eq("user_id", caller.user.id).maybeSingle();
  if (!owner) return fail("เฉพาะเจ้าของสมุดเท่านั้น", 403);
  const ownerId = caller.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("ข้อมูลไม่ถูกต้อง");
  }
  const linkedTrainer = async (id: unknown) => {
    if (typeof id !== "string") return null;
    const { data } = await admin.from("coach_links").select("trainer_id").eq("trainer_id", id).eq("client_id", ownerId).maybeSingle();
    return data ? id : null;
  };

  switch (body?.action) {
    case "list": {
      const { data: links, error } = await admin.from("coach_links").select("trainer_id,status").eq("client_id", ownerId);
      if (error) return fail(error.message, 500);
      const out = [];
      for (const link of links ?? []) {
        const [{ data: profile }, { data: user }] = await Promise.all([
          admin.from("profiles").select("username,display_name,disabled").eq("id", link.trainer_id).maybeSingle(),
          admin.auth.admin.getUserById(link.trainer_id),
        ]);
        out.push({
          id: link.trainer_id,
          username: profile?.username ?? "",
          displayName: profile?.display_name ?? "",
          disabled: !!profile?.disabled || link.status !== "active",
          lastSignInAt: user?.user?.last_sign_in_at ?? null,
        });
      }
      return json({ trainers: out });
    }
    case "create": {
      const username = String(body.username ?? "").trim().toLowerCase();
      const displayName = String(body.displayName ?? "").trim().slice(0, 80);
      if (!USERNAME.test(username)) return fail("ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–32 ตัว");
      if (!validPassword(body.password)) return fail("รหัสผ่านต้องยาว 8–72 ตัวอักษร");
      const { data: taken } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
      if (taken) return fail("ชื่อผู้ใช้นี้ถูกใช้แล้ว");
      const { data: created, error } = await admin.auth.admin.createUser({
        email: emailFor(username),
        password: body.password,
        email_confirm: true,
        user_metadata: { display_name: displayName || username },
      });
      if (error || !created.user) return fail(error?.message ?? "สร้างบัญชีไม่สำเร็จ", 500);
      const id = created.user.id;
      const p = await admin.from("profiles").insert({ id, username, display_name: displayName || username, role: "trainer" });
      const l = await admin.from("coach_links").insert({ trainer_id: id, client_id: ownerId, status: "active", can_view: true });
      if (p.error || l.error) {
        await admin.auth.admin.deleteUser(id);
        return fail((p.error ?? l.error)!.message, 500);
      }
      return json({ id, username });
    }
    case "set_password": {
      const id = await linkedTrainer(body.id);
      if (!id) return fail("ไม่พบบัญชีเทรนเนอร์", 404);
      if (!validPassword(body.password)) return fail("รหัสผ่านต้องยาว 8–72 ตัวอักษร");
      const { error } = await admin.auth.admin.updateUserById(id, { password: body.password });
      return error ? fail(error.message, 500) : json({ ok: true });
    }
    case "set_disabled": {
      const id = await linkedTrainer(body.id);
      if (!id) return fail("ไม่พบบัญชีเทรนเนอร์", 404);
      const disabled = body.disabled === true;
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: disabled ? "876000h" : "none" });
      if (error) return fail(error.message, 500);
      await admin.from("profiles").update({ disabled }).eq("id", id);
      await admin.from("coach_links").update({ status: disabled ? "revoked" : "active" }).eq("trainer_id", id).eq("client_id", ownerId);
      return json({ ok: true });
    }
    default:
      return fail("ไม่รู้จักคำสั่ง");
  }
});
