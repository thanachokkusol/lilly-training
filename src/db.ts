import { openDB } from "idb";
import type { Entry, Kind, Session } from "./types";
import { validateEntry } from "./validation";
import { exerciseKey, octoberWalkWeek, today } from "./core";
import { planSessionMove, type MachineMove } from "./migration";
import { exerciseGuideFrames, homeCoachRoutine, homeLegsRoutine, homeGym, homeMoves, isObsoleteHomeRoutine } from "./homeTraining";
import { noGym } from "./catalog";
import { gymCatalogId, gymInUse, gymsFor, type Gym } from "./gyms";
import { chestStretchRoutine, needsChestStretchUpgrade, stretchMoves } from "./stretchTraining";
const loadZip = () => import("jszip").then((m) => m.default);
export const sandbox =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("sandbox") === "1";
const db = openDB(
  sandbox ? "lilly-training-sandbox-v1" : "lilly-training-v1",
  1,
  {
    upgrade(d) {
      d.createObjectStore("entries", { keyPath: "id" });
      d.createObjectStore("photos");
    },
  },
);
let readOnlyReason = "";
/** While a trainer views a client's journal nothing may be written locally. */
export function setReadOnly(reason: string) {
  readOnlyReason = reason;
}
export const isReadOnly = () => !!readOnlyReason;
function assertWritable() {
  if (readOnlyReason) throw Error(readOnlyReason);
}
export async function allEntries(): Promise<Entry[]> {
  return (await db).getAll("entries");
}
export async function getEntry(id: string): Promise<Entry | undefined> {
  return (await db).get("entries", id);
}
export async function putEntry(e: Entry) {
  await (await db).put("entries", e);
}
export async function alignOctoberWalkWeeks(ids: string[]) {
  assertWritable();
  const tx = (await db).transaction("entries", "readwrite");
  for (const id of ids) {
    const entry = await tx.store.get(id) as Entry | undefined;
    const week = entry && octoberWalkWeek(entry);
    if (entry && week) await tx.store.put({
      ...entry, data: { ...entry.data, week }, dirty: true, updatedAt: new Date().toISOString(),
    });
  }
  await tx.done;
}
export async function removeEmptyNovemberPulldown() {
  const tx = (await db).transaction("entries", "readwrite");
  const entries = await tx.store.getAll() as Entry[];
  const candidates = entries.filter((entry) => entry.kind === "session" && !entry.deleted && !entry.conflict &&
    entry.data.date === "2026-11-24" && /^Upper Body(?:\s+24\s*พ\.?ย\.?(?:\s*2026)?)?$/i.test(entry.data.title));
  if (candidates.length === 1) {
    const entry = candidates[0];
    const session: Session = entry.data;
    const exercise = session.exercises.find((item) => !item.note?.trim() &&
      item.sets.every((set) => !set.done && set.load == null && set.reps == null && !set.loadText?.trim()) &&
      entries.some((machine) => machine.id === item.machineId && machine.kind === "machine" &&
        machine.data.name === "Wide-Grip Lat Pulldown"));
    if (exercise) await tx.store.put({
      ...entry, dirty: true, updatedAt: new Date().toISOString(),
      data: { ...session, exercises: session.exercises.filter((item) => item !== exercise) },
    });
  }
  await tx.done;
}
export async function addBundledMachinePhotos(machineId: string, name: string, guide: string) {
  assertWritable();
  const candidates = exerciseGuideFrames(guide).map((frame) => ({
    id: `guide-photo-${machineId}-${frame}`,
    url: `${import.meta.env.BASE_URL}exercise-guides/${guide}/${frame}.jpg`,
  }));
  const missing = (await Promise.all(candidates.map(async (photo) => {
    if (await getEntry(photo.id)) return null;
    const response = await fetch(photo.url);
    if (!response.ok) throw Error("โหลดรูปประกอบท่าไม่สำเร็จ");
    return { ...photo, blob: await response.blob() };
  }))).filter((photo) => photo !== null);
  const tx = (await db).transaction(["entries", "photos"], "readwrite");
  const records = tx.objectStore("entries");
  for (const photo of missing) {
    if (await records.get(photo.id)) continue;
    await tx.objectStore("photos").put(photo.blob, photo.id);
    await records.add({
      id: photo.id, kind: "photo", dirty: true, version: 0, updatedAt: new Date().toISOString(),
      data: { machineId, label: name, mime: "image/jpeg" },
    });
  }
  const retired = await records.get(`guide-photo-${machineId}-0`) as Entry | undefined;
  if (retired && !retired.deleted && !exerciseGuideFrames(guide).includes(0))
    await records.put({ ...retired, deleted: true, dirty: true, updatedAt: new Date().toISOString() });
  await tx.done;
}
export async function addMissingHomeTraining(obsoleteId?: string) {
  assertWritable();
  const tx = (await db).transaction("entries", "readwrite");
  const existing = new Set(await tx.store.getAllKeys());
  const defaults = [
    ...[...homeMoves, ...stretchMoves].map(({ id, ...data }) => ({ id, kind: "machine" as const, data: { ...data, gym: homeGym } })),
    { ...homeCoachRoutine, kind: "routine" as const },
    { ...chestStretchRoutine, kind: "routine" as const },
    { ...homeLegsRoutine, kind: "routine" as const },
  ];
  const updatedAt = new Date().toISOString();
  const missing: Entry[] = defaults.filter(({ id }) => !existing.has(id))
    .map((entry) => ({ ...entry, updatedAt, dirty: true, version: 0 }));
  missing.forEach(validateEntry);
  const obsolete = obsoleteId ? await tx.store.get(obsoleteId) as Entry | undefined : undefined;
  const changes = missing.map((entry) => tx.store.add(entry));
  const chest = await tx.store.get(chestStretchRoutine.id) as Entry | undefined;
  if (chest && !chest.deleted && needsChestStretchUpgrade(chest.data)) changes.push(tx.store.put({
    ...chest, updatedAt, dirty: true,
    data: { ...chest.data, machineIds: chestStretchRoutine.data.machineIds, note: chestStretchRoutine.data.note },
  }));
  if (obsolete && isObsoleteHomeRoutine(obsolete)) changes.push(tx.store.put({
    ...obsolete, data: { ...obsolete.data, retiredBy: homeCoachRoutine.id }, updatedAt, dirty: true, deleted: true,
  }));
  await Promise.all([...changes, tx.done]);
}
/** Remove an unused gym from the list; its put-away machines go to the trash, where they can be restored. */
export async function removeGym(id: string) {
  assertWritable();
  const tx = (await db).transaction("entries", "readwrite");
  const entries = await tx.store.getAll() as Entry[];
  const gym = gymsFor(entries).find((item) => item.id === id);
  if (!gym || id === noGym || gymInUse(entries, id)) {
    await tx.done;
    throw Error("ยิมนี้ยังมีเครื่องที่ใช้อยู่หรือมีประวัติการฝึก ลบไม่ได้");
  }
  const updatedAt = new Date().toISOString();
  const saved = entries.find((e) => e.id === gymCatalogId);
  const all = [...(saved && !saved.deleted ? saved.data.gyms as Gym[] : gymsFor(entries))].filter((item) => item.id !== noGym);
  const catalog = { id: gymCatalogId, kind: "settings" as const, version: 0, ...saved, updatedAt, dirty: true, deleted: false,
    data: { gyms: [...all.filter((item) => item.id !== id), { ...gym, archived: true, removed: true }] } };
  validateEntry(catalog);
  await tx.store.put(catalog);
  for (const machine of entries)
    if (machine.kind === "machine" && machine.data.gym === id && !machine.deleted)
      await tx.store.put({ ...machine, updatedAt, dirty: true, deleted: true });
  await tx.done;
}
export async function moveMachinePhoto(photoId: string, from: string, to: string) {
  assertWritable();
  if (from === to) return;
  const tx = (await db).transaction("entries", "readwrite");
  const [photo, source, target] = await Promise.all([photoId, from, to].map((id) => tx.store.get(id) as Promise<Entry | undefined>));
  if (!photo || photo.kind !== "photo" || photo.data.machineId !== from ||
      !source || source.kind !== "machine" || !target || target.kind !== "machine" ||
      [photo, source, target].some((e) => e.deleted || e.conflict))
    throw Error("รูปหรือเครื่องเปลี่ยนแล้ว กรุณาเปิดข้อมูลล่าสุด");
  const updatedAt = new Date().toISOString();
  await Promise.all([
    tx.store.put({ ...photo, updatedAt, dirty: true, data: { ...photo.data, machineId: to, label: target.data.name } }),
    tx.store.put({ ...source, updatedAt, dirty: true, data: {
      ...source.data,
      photoId: source.data.photoId === photoId ? undefined : source.data.photoId,
      referencePhotoId: source.data.referencePhotoId === photoId ? undefined : source.data.referencePhotoId,
    } }),
    tx.store.put({ ...target, updatedAt, dirty: true, data: { ...target.data, photoId } }),
    tx.done,
  ]);
}
export async function mergeExerciseGroups(sourceKey: string, targetKey: string) {
  assertWritable();
  if (sourceKey === targetKey) throw Error("เลือกท่าที่ต่างกัน");
  const tx = (await db).transaction("entries", "readwrite");
  const entries = (await tx.store.getAll()) as Entry[];
  const machines = entries.filter((e) => e.kind === "machine");
  const source = machines.filter((e) => exerciseKey(e.data) === sourceKey);
  const target = machines.filter((e) => exerciseKey(e.data) === targetKey);
  const canonical = target.find((e) => !e.deleted)?.data;
  const affected = [...source, ...target];
  if (!source.some((e) => !e.deleted) || !canonical || affected.some((e) => e.conflict))
    throw Error("ไม่พบทั้งสองท่าหรือมีรายการรอแก้ข้อขัดแย้ง");
  const aliases = [...new Set<string>(affected.flatMap((e) =>
    [e.data.name, e.data.thai, ...(e.data.aliases ?? [])].filter(Boolean),
  ))].filter((name) => name !== canonical.name && name !== canonical.thai);
  const updatedAt = new Date().toISOString();
  const changes: Entry[] = affected.map((e) => ({
    ...e, updatedAt, dirty: true,
    data: { ...e.data, exerciseId: targetKey, name: canonical.name,
      thai: canonical.thai, group: canonical.group, aliases },
  }));
  const oldNames = new Map(source.map((e) => [e.id, e.data.name as string]));
  for (const entry of entries) {
    if (entry.kind !== "session") continue;
    const session = entry.data as Session;
    if (!session.exercises.some((exercise) => oldNames.has(exercise.machineId) && !exercise.originalName)) continue;
    if (entry.conflict) throw Error("พบครั้งฝึกที่รอแก้ข้อขัดแย้ง กรุณาแก้ก่อนรวมท่า");
    changes.push({ ...entry, updatedAt, dirty: true, data: {
      ...session,
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        originalName: exercise.originalName ?? oldNames.get(exercise.machineId),
      })),
    } });
  }
  changes.forEach(validateEntry);
  await Promise.all([...changes.map((e) => tx.store.put(e)), tx.done]);
}
export async function moveReviewedSession(
  expected: Entry,
  gym: string,
  moves: MachineMove[],
) {
  assertWritable();
  const tx = (await db).transaction("entries", "readwrite");
  const entries = await tx.store.getAll() as Entry[];
  const current = entries.find((entry) => entry.id === expected.id);
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw Error("ครั้งฝึกเปลี่ยนหลังตรวจ กรุณาตรวจข้อมูลล่าสุดก่อนย้าย");
  }
  const updatedAt = new Date().toISOString();
  const changes = planSessionMove(entries, expected.id, gym, moves);
  await Promise.all([...changes.map((change) => tx.store.put({
    ...change,
    updatedAt,
    version: change.id === expected.id ? expected.version : 0,
    dirty: true,
  })), tx.done]);
}
export async function save(
  kind: Kind,
  data: any,
  id: string = crypto.randomUUID(),
) {
  assertWritable();
  validateEntry({ id, kind, data });
  const old = (await (await db).get("entries", id)) as Entry | undefined;
  // Relinking a photo keeps the fingerprint that recognises it when chosen again.
  if (kind === "photo" && old?.data?.sourceHash && data.sourceHash === undefined)
    data = { ...data, sourceHash: old.data.sourceHash };
  const e: Entry = {
    id,
    kind,
    data,
    updatedAt: new Date().toISOString(),
    version: old?.version ?? 0,
    dirty: true,
    deleted: false,
    conflict: old?.conflict,
  };
  await putEntry(e);
  return e;
}
export async function trash(id: string) {
  assertWritable();
  const e = (await (await db).get("entries", id)) as Entry;
  e.deleted = true;
  e.dirty = true;
  e.updatedAt = new Date().toISOString();
  await putEntry(e);
}
export async function restoreEntry(id: string) {
  assertWritable();
  const e = (await (await db).get("entries", id)) as Entry;
  e.deleted = false;
  e.dirty = true;
  e.updatedAt = new Date().toISOString();
  await putEntry(e);
}
export async function photoBlob(id: string): Promise<Blob | undefined> {
  return (await db).get("photos", id);
}
export async function storePhoto(id: string, blob: Blob) {
  await (await db).put("photos", blob, id);
}
export async function clearPhotoBlob(id: string) {
  await (await db).delete("photos", id);
}
/** 720 pixels on the short side is enough to read a screen or recognise a machine, and keeps storage in the free plan. */
export const photoScale = (width: number, height: number) =>
  Math.min(1, 720 / Math.min(width, height), 3000 / Math.max(width, height));
/** Fingerprint of the file as chosen, so the same picture added twice can be recognised. */
export async function fileHash(file: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((n) => n.toString(16).padStart(2, "0")).join("");
}
export async function addPhoto(file: Blob, label: string) {
  assertWritable();
  if (file.size > 30 * 1024 * 1024) throw Error("รูปต้องไม่เกิน 30 MB");
  if (!file.type.startsWith("image/")) throw Error("เลือกไฟล์รูปภาพ");
  // A browser that cannot fingerprint the file still adds it, just without the duplicate check.
  const sourceHash = await fileHash(file).catch(() => undefined);
  const same = sourceHash && (await allEntries()).find((e) => e.kind === "photo" && !e.deleted && e.data.sourceHash === sourceHash);
  if (same) throw Error("มีรูปนี้แล้ว ไม่ได้เพิ่มซ้ำ");
  const bitmap = await createImageBitmap(file);
  const scale = photoScale(bitmap.width, bitmap.height);
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(Error("อ่านรูปไม่ได้"))),
      "image/jpeg",
      0.8,
    ),
  );
  const id: string = crypto.randomUUID();
  await storePhoto(id, blob);
  await save("photo", { label, mime: "image/jpeg", ...(sourceHash && { sourceHash }) }, id);
  return id;
}
export async function exportBackup() {
  const JSZip = await loadZip();
  const zip = new JSZip(),
    entries = await allEntries();
  zip.file(
    "backup.json",
    JSON.stringify(
      {
        format: "lilly-training",
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        entries,
      },
      null,
      2,
    ),
  );
  for (const e of entries.filter((e) => e.kind === "photo")) {
    const b = await photoBlob(e.id);
    if (b) zip.file(`photos/${e.id}`, b);
  }
  return zip.generateAsync({ type: "blob" });
}
const kinds = new Set([
  "machine",
  "session",
  "cardio",
  "body",
  "photo",
  "archive",
  "settings",
  "routine",
]);
export async function inspectBackup(file: Blob) {
  if (file.size > 350 * 1024 * 1024) throw Error("ไฟล์สำรองใหญ่เกิน 350 MB");
  const JSZip = await loadZip();
  const zip = await JSZip.loadAsync(file);
  if (Object.keys(zip.files).length > 5000) throw Error("ไฟล์สำรองมีไฟล์มากเกินไป");
  const manifest = zip.file("backup.json");
  if (!manifest) throw Error("ไม่พบ backup.json");
  const content = await manifest.async("string");
  if (content.length > 30_000_000) throw Error("ข้อมูลสำรองใหญ่เกินกำหนด");
  const data = JSON.parse(content);
  if (
    data.format !== "lilly-training" ||
    data.schemaVersion !== 1 ||
    !Array.isArray(data.entries)
  )
    throw Error("รูปแบบไฟล์สำรองไม่ถูกต้อง");
  for (const e of data.entries) {
    validateEntry(e);
    if (
      typeof e.id !== "string" ||
      !kinds.has(e.kind) ||
      !e.data ||
      typeof e.data !== "object"
    )
      throw Error("พบรายการสำรองไม่ถูกต้อง");
    if (
      e.kind === "cardio" &&
      (!Number.isInteger(e.data.seconds) ||
        e.data.seconds <= 0 ||
        e.data.seconds > 86400 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.data.date) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.data.week))
    )
      throw Error("รายการคาร์ดิโอไม่ถูกต้อง");
  }
  const ids = data.entries.map((e: Entry) => e.id);
  if (new Set(ids).size !== ids.length) throw Error("ไฟล์สำรองมีรหัสซ้ำกัน");
  const now = today();
  // Plans or typos dated in the future must never count as finished results.
  const future = (data.entries as Entry[]).filter(
    (e) =>
      !e.deleted &&
      ((e.kind === "cardio" &&
        e.data.status === "confirmed" &&
        e.data.date > now) ||
        (e.kind === "session" &&
          e.data.status !== "draft" &&
          e.data.date > now)),
  );
  return { zip, entries: data.entries as Entry[], future };
}
export async function importBackup(file: Blob, replaceExisting = false) {
  assertWritable();
  const { zip, entries, future } = await inspectBackup(file);
  const futureIds = new Set(future.map((e) => e.id));
  const existing = new Map((await allEntries()).map((e) => [e.id, e]));
  let added = 0,
    skipped = 0;
  for (const e of entries) {
    const old = existing.get(e.id);
    if (
      old &&
      replaceExisting &&
      e.kind === "photo" &&
      JSON.stringify(old.data) === JSON.stringify(e.data)
    ) {
      const previous = await photoBlob(e.id),
        incoming = zip.file(`photos/${e.id}`);
      if (previous && incoming) {
        const a = new Uint8Array(await previous.arrayBuffer()),
          b = await incoming.async("uint8array");
        if (a.length === b.length && a.every((v, i) => v === b[i])) {
          skipped++;
          continue;
        }
      }
    }
    if (
      old &&
      replaceExisting &&
      JSON.stringify(old.data) === JSON.stringify(e.data) &&
      !!old.deleted === !!e.deleted &&
      e.kind !== "photo"
    ) {
      skipped++;
      continue;
    }
    if (old && !replaceExisting) {
      skipped++;
      continue;
    }
    if (old) {
      const snapshotId = "prior-" + crypto.randomUUID();
      await save(
        "archive",
        {
          title:
            "ฉบับก่อนกู้คืน · " +
            (old.data.name ?? old.data.title ?? old.data.activity ?? old.kind),
          text: JSON.stringify(old, null, 2),
        },
        snapshotId,
      );
      if (old.kind === "photo") {
        const previous = await photoBlob(old.id);
        if (previous) {
          const priorPhotoId = "photo-" + crypto.randomUUID();
          await storePhoto(priorPhotoId, previous);
          await save(
            "photo",
            { label: "รูปก่อนกู้คืน " + old.data.label, mime: old.data.mime },
            priorPhotoId,
          );
        }
      }
    }
    if (e.kind === "photo") {
      const p = zip.file(`photos/${e.id}`);
      if (p) {
        const bytes = await p.async("uint8array");
        if (bytes.length > 15 * 1024 * 1024)
          throw Error("รูปในไฟล์สำรองใหญ่เกิน 15 MB");
        const mime = ["image/jpeg", "image/png", "image/webp"].includes(
          e.data.mime,
        )
          ? e.data.mime
          : "image/jpeg";
        await storePhoto(e.id, new Blob([bytes], { type: mime }));
      }
    }
    const data = futureIds.has(e.id)
      ? e.kind === "cardio"
        ? { ...e.data, status: "review" }
        : { ...e.data, status: "draft" }
      : e.data;
    await putEntry({
      ...e,
      data,
      dirty: true,
      version: old?.version ?? 0,
      updatedAt: new Date().toISOString(),
      conflict: undefined,
    });
    added++;
  }
  return { added, skipped, demoted: futureIds.size };
}
export function download(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
export async function exportCSV() {
  const rows = [["id", "ประเภท", "วันที่", "ข้อมูล", "แหล่งข้อมูล"]];
  for (const e of (await allEntries()).filter(
    (e) => !e.deleted && e.kind !== "photo",
  ))
    rows.push([
      e.id,
      e.kind,
      e.data.date ?? "",
      JSON.stringify(e.data),
      e.data.source ?? "",
    ]);
  const escape = (v: string) =>
    '"' + (/^[=+\-@]/.test(v) ? "'" : "") + v.replaceAll('"', '""') + '"';
  return new Blob(
    ["\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
}

/**
 * This browser keeps a local copy of one account's journal. Wipe it so another account can
 * sign in, unless it still holds changes that have not reached the cloud yet.
 * Returns false (and changes nothing) when unsynced changes would be lost.
 */
export async function clearLocalAccount(): Promise<boolean> {
  const d = await db;
  const entries = (await d.getAll("entries")) as Entry[];
  if (entries.some((e) => e.dirty)) return false;
  const tx = d.transaction(["entries", "photos"], "readwrite");
  await Promise.all([tx.objectStore("entries").clear(), tx.objectStore("photos").clear(), tx.done]);
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("lilly-") && key !== "lilly-cloud") localStorage.removeItem(key);
  } catch { /* storage may be unavailable; the database is already clear */ }
  return true;
}
/** Make this browser's local copy belong to `userId`, clearing another account's copy if safe. */
export async function adoptLocalAccount(userId: string): Promise<boolean> {
  const bound = localStorage.getItem("lilly-owner");
  if (bound && bound !== userId && !(await clearLocalAccount())) return false;
  localStorage.setItem("lilly-owner", userId);
  return true;
}
