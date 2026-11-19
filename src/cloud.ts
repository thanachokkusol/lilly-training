import type { SupabaseClient } from "@supabase/supabase-js";
import {
  allEntries,
  getEntry,
  putEntry,
  photoBlob,
  storePhoto,
  sandbox,
} from "./db";
import { validateEntry } from "./validation";
export interface CloudConfig {
  url: string;
  key: string;
}
export const config = (): CloudConfig | null => {
  if (sandbox) return null;
  try {
    const saved = JSON.parse(localStorage.getItem("lilly-cloud") || "null");
    if (saved) return saved;
    const url = import.meta.env.VITE_SUPABASE_URL,
      key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    return url && key ? { url, key } : null;
  } catch {
    return null;
  }
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
  if (!c.key.startsWith("sb_publishable_") && !c.key.startsWith("eyJ"))
    throw Error("ใช้ Publishable หรือ anon key เท่านั้น");
  if (c.key.startsWith("eyJ")) {
    try {
      const p = JSON.parse(atob(c.key.split(".")[1]));
      if (p.role !== "anon") throw Error();
    } catch {
      throw Error("ห้ามใช้ service_role หรือ secret key");
    }
  }
  localStorage.setItem("lilly-cloud", JSON.stringify(c));
  client = null;
}
let syncing = false;
export async function sync() {
  if (syncing) return { pushed: 0, pulled: 0, conflicts: 0 };
  const c = await cloud();
  if (!c) throw Error("ยังไม่ได้เชื่อม Supabase");
  const {
    data: { user },
    error: authError,
  } = await c.auth.getUser();
  if (authError || !user) throw Error("เข้าสู่ระบบก่อนซิงก์");
  const { data: allowed, error: ownerError } = await c.rpc("is_training_owner");
  if (ownerError || allowed !== true)
    throw Error("บัญชีนี้ยังไม่ได้รับสิทธิ์เจ้าของสมุดใน Supabase");
  const bound = localStorage.getItem("lilly-owner");
  if (bound && bound !== user.id)
    throw Error("ข้อมูลในเครื่องผูกกับบัญชีอื่น กรุณาส่งออกและใช้เบราว์เซอร์แยกบัญชี");
  localStorage.setItem("lilly-owner", user.id);
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
    let offset = 0;
    for (;;) {
      const { data, error } = await c
        .from("training_records")
        .select("*")
        .eq("user_id", user.id)
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      for (const row of data ?? []) {
        const current = await getEntry(row.id);
        if (current?.dirty || current?.conflict) continue;
        validateEntry({ id: row.id, kind: row.kind, data: row.payload });
        await putEntry({
          id: row.id,
          kind: row.kind,
          data: row.payload,
          version: row.version,
          updatedAt: row.updated_at,
          dirty: false,
          deleted: row.deleted,
        });
        pulled++;
        if (
          row.kind === "photo" &&
          !row.deleted &&
          (!(await photoBlob(row.id)) ||
            current?.data._photoPath !== row.payload._photoPath)
        ) {
          const { data: b, error: photoError } = await c.storage
            .from("training-photos")
            .download(row.payload._photoPath ?? `${user.id}/${row.id}.jpg`);
          if (photoError) throw photoError;
          if (b) await storePhoto(row.id, b);
        }
      }
      if ((data?.length ?? 0) < 500) break;
      offset += 500;
    }
    return { pushed, pulled, conflicts };
  } finally {
    syncing = false;
  }
}
export async function resolveConflict(id: string, choice: "local" | "remote") {
  const e = (await allEntries()).find((e) => e.id === id);
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
