// Supabase Edge Function: member-signup
// Public sign-up for friends, allowed only with the owner's invite code.
// Accounts made here are always "friend" (never coach or owner).
// Deploy with "Verify JWT" off: callers are not signed in yet.
// The request logic is a plain function so it can be tested without Deno or Supabase.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const USERNAME = /^[a-z0-9._-]{3,32}$/;

// deno-lint-ignore no-explicit-any
export async function handleSignup(req: Request, admin: any): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("ข้อมูลไม่ถูกต้อง");
  }
  const code = String(body?.inviteCode ?? "").trim();
  const username = String(body?.username ?? "").trim().toLowerCase();
  const displayName = String(body?.displayName ?? "").trim().slice(0, 80);
  const password = body?.password;

  const { data: settings } = await admin.from("signup_settings").select("enabled,invite_code").maybeSingle();
  // Same message for "closed" and "wrong code" so the code cannot be probed.
  if (!settings?.enabled || !settings.invite_code || code !== settings.invite_code)
    return fail("รหัสเชิญไม่ถูกต้อง หรือยังไม่เปิดรับสมัคร", 403);
  if (!displayName) return fail("กรอกชื่อที่แสดง");
  if (!USERNAME.test(username)) return fail("ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - ยาว 3–32 ตัว");
  if (typeof password !== "string" || password.length < 8 || password.length > 72)
    return fail("รหัสผ่านต้องยาว 8–72 ตัวอักษร");

  // Simple brake against abuse of a leaked code.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true })
    .eq("role", "friend").gte("created_at", since);
  if ((count ?? 0) >= 20) return fail("มีการสมัครมากเกินไป ลองใหม่ภายหลัง", 429);

  const { data: taken } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) return fail("ชื่อผู้ใช้นี้ถูกใช้แล้ว");
  const { data: created, error } = await admin.auth.admin.createUser({
    email: `${username}@lilly.local`,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !created?.user)
    return fail(/already/i.test(error?.message ?? "") ? "ชื่อผู้ใช้นี้ถูกใช้แล้ว" : "สมัครไม่สำเร็จ", 400);
  const profile = await admin.from("profiles").insert({
    id: created.user.id, username, display_name: displayName, role: "friend",
  });
  if (profile.error) {
    await admin.auth.admin.deleteUser(created.user.id);
    return fail("สมัครไม่สำเร็จ", 500);
  }
  return json({ ok: true, username });
}

// deno-lint-ignore no-explicit-any
const deno = (globalThis as any).Deno;
if (deno?.serve) {
  // @ts-ignore Deno resolves npm: specifiers; the web app's TypeScript does not.
  const { createClient } = await import(/* @vite-ignore */ "npm:@supabase/supabase-js@2");
  deno.serve(async (req: Request) => {
    const url = deno.env.get("SUPABASE_URL");
    const service = deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      (Object.values(JSON.parse(deno.env.get("SUPABASE_SECRET_KEYS") || "{}"))[0] as string | undefined);
    if (!url || !service) return fail("ระบบสมัครยังไม่พร้อม", 500);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    return handleSignup(req, admin);
  });
}
