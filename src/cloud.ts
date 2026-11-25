import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allEntries,
  getEntry,
  putEntry,
  photoBlob,
  storePhoto,
  clearPhotoBlob,
  sandbox,
  adoptLocalAccount,
} from "./db";
import { validateEntry } from "./validation";
import type { Entry } from "./types";
export interface CloudConfig {
  url: string;
  key: string;
}
function validCloudConfig(value: unknown): value is CloudConfig {
  if (!value || typeof value !== "object" || !("url" in value) || !("key" in value) ||
    typeof value.url !== "string" || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value.url) ||
    typeof value.key !== "string") return false;
  if (value.key.startsWith("sb_publishable_")) return true;
  if (!value.key.startsWith("eyJ")) return false;
  try {
    const payload = value.key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    return JSON.parse(atob(payload)).role === "anon";
  } catch {
    return false;
  }
}
export const config = (): CloudConfig | null => {
  if (sandbox) return null;
  try {
    const saved = JSON.parse(localStorage.getItem("lilly-cloud") || "null");
    if (validCloudConfig(saved)) return saved;
  } catch {
    // Ignore invalid old browser configuration and fall back to the build settings.
  }
  const built = { url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
  return validCloudConfig(built) ? built : null;
};
let client: Promise<SupabaseClient> | null = null;
/** Supabase is only downloaded when a cloud project is configured. */
export async function cloud(): Promise<SupabaseClient | null> {
  const c = config();
  if (!c) return null;
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(c.url, c.key),
  );
  return client;
}
/** Stable comparison that ignores jsonb key order and server-only photo paths. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v)
        .filter((k) => k !== "_photoPath" && (v as any)[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical((v as any)[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(v ?? null);
}
export const sameData = (a: unknown, b: unknown) =>
  canonical(a) === canonical(b);
export function configure(c: CloudConfig) {
  if (sandbox) throw Error("พื้นที่ทดสอบไม่เชื่อมบัญชีออนไลน์");
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(c.url))
    throw Error("ใช้ Project URL รูปแบบ https://….supabase.co");
  if (!validCloudConfig(c)) throw Error("ใช้ Publishable หรือ anon key เท่านั้น");
  localStorage.setItem("lilly-cloud", JSON.stringify(c));
  client = null;
}
let syncing = false;
export async function sync(onRecordsReady?: (userId: string) => Promise<void>) {
  if (syncing) return { pushed: 0, pulled: 0, conflicts: 0, missingPhotos: 0 };
  const c = await cloud();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  const {
    data: { user },
    error: authError,
  } = await c.auth.getUser();
  if (authError || !user) throw Error("เข้าสู่ระบบก่อนซิงก์");
  const { data: allowed, error: ownerError } = await c.rpc("is_training_owner");
  if (ownerError || allowed !== true)
    throw Error("บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้สมุดฝึก");
  if (!(await adoptLocalAccount(user.id)))
    throw Error("เครื่องนี้ยังมีรายการรอซิงก์ของบัญชีก่อนหน้า เข้าบัญชีเดิมให้ซิงก์เสร็จก่อน แล้วค่อยสลับบัญชี");
  localStorage.setItem("lilly-owner-project", config()!.url);
  syncing = true;
  let pushed = 0,
    pulled = 0,
    conflicts = 0;
  try {
    for (const e of (await allEntries()).filter(
      (e) => e.dirty && !e.conflict,
    )) {
      validateEntry(e);
      let payload = e.data;
      if (e.kind === "photo" && !e.deleted) {
        const b = await photoBlob(e.id);
        if (b) {
          const digest = await crypto.subtle.digest(
            "SHA-256",
            await b.arrayBuffer(),
          );
          const hash = Array.from(new Uint8Array(digest))
            .map((n) => n.toString(16).padStart(2, "0"))
            .join("");
          const path = `${user.id}/${e.id}/${hash}.jpg`;
          const { error } = await c.storage
            .from("training-photos")
            .upload(path, b, { contentType: "image/jpeg", upsert: false });
          if (error && String((error as any).statusCode) !== "409") throw error;
          payload = { ...e.data, _photoPath: path };
        }
      }
      const { data, error } = await c.rpc("save_training_record", {
        record_id: e.id,
        record_kind: e.kind,
        record_payload: payload,
        expected_version: e.version,
        is_deleted: !!e.deleted,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      const now = await getEntry(e.id);
      if (!now) continue;
      if (
        !result.saved &&
        !!result.deleted === !!now.deleted &&
        sameData(result.payload, now.data)
      ) {
        // Same record already online (e.g. the backup was imported on both devices).
        now.version = result.version;
        now.data = result.payload;
        now.dirty = false;
        await putEntry(now);
      } else if (!result.saved) {
        now.conflict = {
          data: result.payload,
          version: result.version,
          deleted: result.deleted,
        };
        now.dirty = true;
        await putEntry(now);
        conflicts++;
      } else {
        const unchanged =
          now.updatedAt === e.updatedAt &&
          JSON.stringify(now.data) === JSON.stringify(e.data) &&
          !!now.deleted === !!e.deleted;
        now.version = result.version;
        if (unchanged) now.data = payload;
        now.dirty = !unchanged;
        await putEntry(now);
        pushed++;
      }
    }
    let lastId: string | undefined;
    const photos: Array<{ id: string; path: string; version: number }> = [];
    for (;;) {
      const query = c
        .from("training_records")
        .select("id,kind,payload,version,deleted,updated_at,user_id")
        .or(`user_id.eq.${user.id},shared.eq.true`)
        .order("id")
        .limit(500);
      const { data, error } = await (lastId ? query.gt("id", lastId) : query);
      if (error) throw error;
      for (const row of data ?? []) {
        const current = await getEntry(row.id);
        if (current?.dirty || current?.conflict) continue;
        const data = row.kind === "photo" && !row.deleted
          ? { ...row.payload, _photoPath: row.payload._photoPath ?? `${row.user_id}/${row.id}.jpg` }
          : row.payload;
        const unchanged = current && current.version === row.version && current.kind === row.kind &&
          !!current.deleted === row.deleted && current.data._photoPath === data._photoPath;
        if (!unchanged) validateEntry({ id: row.id, kind: row.kind, data: row.payload });
        if (row.kind === "photo" && !row.deleted) {
          if (current && current.data._photoPath && current.data._photoPath !== data._photoPath)
            await clearPhotoBlob(row.id);
          if (!(await photoBlob(row.id))) photos.push({
            id: row.id,
            path: data._photoPath,
            version: row.version,
          });
        }
        if (unchanged) continue;
        await putEntry({
          id: row.id,
          kind: row.kind,
          data,
          version: row.version,
          updatedAt: row.updated_at,
          dirty: false,
          deleted: row.deleted,
        });
        pulled++;
      }
      if ((data?.length ?? 0) < 500) break;
      lastId = data!.at(-1)!.id;
    }
    await onRecordsReady?.(user.id);
    let missingPhotos = 0;
    let nextPhoto = 0;
    const fetchPhotos = async () => {
      while (nextPhoto < photos.length) {
        const photo = photos[nextPhoto++];
        try {
          const blob = await remotePhoto(photo.path);
          if (!blob) {
            missingPhotos++;
            continue;
          }
          const entry = await getEntry(photo.id);
          if (entry?.version === photo.version && !entry.dirty && !entry.deleted)
            await storePhoto(photo.id, blob);
        } catch {
          missingPhotos++;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, photos.length) }, fetchPhotos));
    return { pushed, pulled, conflicts, missingPhotos };
  } finally {
    syncing = false;
  }
}
export async function resolveConflict(id: string, choice: "local" | "remote") {
  const e = await getEntry(id);
  if (!e?.conflict) return;
  const r = e.conflict;
  if (choice === "remote") {
    e.data = r.data;
    e.deleted = r.deleted;
    e.dirty = false;
  } else e.dirty = true;
  e.version = r.version;
  e.conflict = undefined;
  e.updatedAt = new Date().toISOString();
  await putEntry(e);
}

/** Trainer accounts sign in with a username; Supabase Auth needs an email, so map it. */
export const loginEmail = (identifier: string) => {
  const id = identifier.trim().toLowerCase();
  return id.includes("@") ? id : `${id}@lilly.local`;
};
export type Profile = { id: string; role: "owner" | "trainer" | "friend"; displayName: string; username: string };
let signedInProfile: Profile | null = null;
/** Profile loaded at sign-in; used to label programs a trainer assigns. */
export const currentProfile = () => signedInProfile;
export async function myProfile(): Promise<Profile | null> {
  signedInProfile = null;
  const c = await cloud();
  if (!c) return null;
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) return null;
  const { data: role } = await c.rpc("journal_role");
  if (role !== "owner" && role !== "trainer" && role !== "friend") return null;
  const { data } = await c.from("profiles").select("display_name,username").eq("id", auth.user.id).maybeSingle();
  return (signedInProfile = {
    id: auth.user.id,
    role,
    displayName: data?.display_name || data?.username || (auth.user.email ?? ""),
    username: data?.username ?? "",
  });
}
export type Client = { id: string; name: string };
/** People whose journal the signed-in trainer may view. */
/** Clients who chose the signed-in coach. Nobody else sees another person's journal. */
export async function myClients(role: "owner" | "trainer" | "friend"): Promise<Client[]> {
  if (role !== "trainer") return [];
  const c = await cloud();
  if (!c) return [];
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) return [];
  const { data: links } = await c.from("coach_links").select("client_id").eq("trainer_id", auth.user.id).eq("status", "active");
  const ids = (links ?? []).map((l) => l.client_id as string);
  if (!ids.length) return [];
  const { data: profiles } = await c.from("profiles").select("id,display_name,username").in("id", ids);
  return ids
    .map((id) => {
      const p = profiles?.find((x) => x.id === id);
      return { id, name: p?.display_name || p?.username || "ยังไม่ได้ตั้งชื่อ" };
    })
    .sort((x, y) => x.name.localeCompare(y.name, "th"));
}
export type Coach = { id: string; name: string; coachingMe: boolean };
export async function listCoaches(): Promise<Coach[]> {
  const c = await cloud();
  if (!c) return [];
  const { data, error } = await c.rpc("list_coaches");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.display_name, coachingMe: r.coaching_me }));
}
export async function setMyCoach(trainer: string, coached: boolean) {
  const c = await cloud();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  const { error } = await c.rpc("set_my_coach", { trainer, coached });
  if (error) throw error;
}
export async function getSignupSettings(): Promise<{ enabled: boolean; inviteCode: string }> {
  const c = await cloud();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  const { data, error } = await c.rpc("get_signup_settings");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { enabled: !!row?.enabled, inviteCode: row?.invite_code ?? "" };
}
export async function setSignupSettings(enabled: boolean) {
  const c = await cloud();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  const { error } = await c.rpc("set_signup_settings", { new_enabled: enabled, new_code: null });
  if (error) throw error;
}
/** Create a friend account (only while the owner keeps sign-up open), then sign in. */
export async function signUp(input: { username: string; displayName: string; password: string }) {
  const c = await cloud();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  const { data, error } = await c.functions.invoke("member-signup", { body: input });
  if (error) {
    let message = "สมัครไม่สำเร็จ";
    try {
      const detail = await (error as any).context?.json?.();
      if (detail?.error) message = detail.error;
    } catch { /* keep the generic message */ }
    throw Error(message);
  }
  if (data?.error) throw Error(data.error);
  const signIn = await c.auth.signInWithPassword({ email: loginEmail(input.username), password: input.password });
  if (signIn.error) throw Error("สมัครแล้ว แต่เข้าสู่ระบบไม่สำเร็จ ลองเข้าสู่ระบบอีกครั้ง");
}
/** Read-only copy of another member's private records (RLS decides what is visible). */
export async function fetchUserRecords(userId: string): Promise<Entry[]> {
  const c = await cloud();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  const out: Entry[] = [];
  let lastId: string | undefined;
  for (;;) {
    const q = c.from("training_records").select("id,kind,payload,version,deleted,updated_at")
      .eq("user_id", userId).eq("shared", false).order("id").limit(500);
    const { data, error } = await (lastId ? q.gt("id", lastId) : q);
    if (error) throw error;
    for (const row of data ?? []) {
      validateEntry({ id: row.id, kind: row.kind, data: row.payload });
      out.push({ id: row.id, kind: row.kind, data: row.payload, version: row.version,
        updatedAt: row.updated_at, dirty: false, deleted: row.deleted });
    }
    if ((data?.length ?? 0) < 500) break;
    lastId = data![data!.length - 1].id;
  }
  return out;
}
/** Who last changed a shared machine. Optional information: null when offline or not available. */
export async function machineEditor(id: string): Promise<{ name: string; at: string } | null> {
  try {
    const c = await cloud();
    if (!c || !navigator.onLine) return null;
    const { data, error } = await c.rpc("shared_machine_editor", { record_id: id });
    const row = Array.isArray(data) ? data[0] : data;
    return error || !row ? null : { name: row.display_name, at: row.updated_at };
  } catch {
    return null;
  }
}
/** Photo of a record not stored on this device (e.g. a client's evidence). */
const pendingPhotos = new Map<string, Promise<Blob | undefined>>();
export function remotePhoto(path: string) {
  const active = pendingPhotos.get(path);
  if (active) return active;
  const request = cloud().then(async (c) => {
    if (!c) return undefined;
    const { data } = await c.storage.from("training-photos").download(path);
    return data ?? undefined;
  }).catch(() => undefined).finally(() => pendingPhotos.delete(path));
  pendingPhotos.set(path, request);
  return request;
}
export async function trainerAdmin(body: Record<string, unknown>) {
  const c = await cloud();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  const { data, error } = await c.functions.invoke("trainer-admin", { body });
  if (error) {
    let message = error.message;
    try {
      const detail = await (error as any).context?.json?.();
      if (detail?.error) message = detail.error;
    } catch { /* keep the generic message */ }
    throw Error(message);
  }
  if (data?.error) throw Error(data.error);
  return data;
}
export async function changeOwnPassword(current: string, next: string) {
  const c = await cloud();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  if (next.length < 8) throw Error("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร");
  const { data: auth } = await c.auth.getUser();
  const email = auth.user?.email;
  if (!email) throw Error("เข้าสู่ระบบก่อน");
  const check = await c.auth.signInWithPassword({ email, password: current });
  if (check.error) throw Error("รหัสผ่านเดิมไม่ถูกต้อง");
  const { error } = await c.auth.updateUser({ password: next });
  if (error) throw error;
}
export async function setMyDisplayName(name: string) {
  const c = await cloud();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  const { error } = await c.rpc("set_my_display_name", { new_name: name.trim() });
  if (error) throw Error(/Invalid/.test(error.message) ? "ชื่อต้องยาว 1–80 ตัวอักษร" : error.message);
  if (signedInProfile) signedInProfile = { ...signedInProfile, displayName: name.trim() };
}
