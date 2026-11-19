import type { Entry } from "./types";
const kinds = [
  "machine",
  "session",
  "cardio",
  "body",
  "photo",
  "archive",
  "settings",
  "routine",
];
export function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === s;
}
const num = (v: unknown, max = 1e6) =>
  v === null ||
  (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max);
export function validateEntry(e: Pick<Entry, "id" | "kind" | "data">) {
  if (
    typeof e.id !== "string" ||
    !e.id ||
    e.id.length > 200 ||
    /[\\/]/.test(e.id) ||
    !kinds.includes(e.kind) ||
    !e.data ||
    typeof e.data !== "object" ||
    Array.isArray(e.data)
  )
    throw Error("รายการข้อมูลไม่ถูกต้อง");
  const d = e.data;
  for (const key of [
    "name",
    "thai",
    "gym",
    "group",
    "setup",
    "cues",
    "note",
    "source",
    "sourceId",
    "title",
    "summary",
    "text",
    "photoId",
    "referencePhotoId",
    "label",
    "mime",
  ])
    if (d[key] != null && typeof d[key] !== "string")
      throw Error("รูปแบบข้อความหรือรหัสอ้างอิงไม่ถูกต้อง");
  if (JSON.stringify(d).length > 5_000_000) throw Error("รายการใหญ่เกินกำหนด");
  if (e.kind === "cardio") {
    if (
      !validDate(d.date) ||
      !validDate(d.week) ||
      !Number.isInteger(d.seconds) ||
      d.seconds <= 0 ||
      d.seconds > 86400 ||
      !["confirmed", "review"].includes(d.status) ||
      typeof d.activity !== "string" ||
      typeof d.walkGoal !== "boolean" ||
      ![d.distance, d.speed, d.incline, d.kcal].every((n) => num(n))
    )
      throw Error("รายการคาร์ดิโอไม่ถูกต้อง");
  }
  if (e.kind === "machine") {
    if (
      !d.name ||
      typeof d.name !== "string" ||
      typeof d.gym !== "string" ||
      typeof d.setup !== "string" ||
      !["total", "per-side", "assistance", "bodyweight"].includes(d.loadMode)
    )
      throw Error("รายละเอียดเครื่องไม่ถูกต้อง");
  }
  if (e.kind === "body") {
    if (
      !validDate(d.date) ||
      ![d.weight, d.waist, d.fat, d.smm].every((n) => num(n)) ||
      (d.fat !== null && d.fat > 100)
    )
      throw Error("ผลวัดไม่ถูกต้อง");
  }
  if (e.kind === "session") {
    if (
      (d.date !== "" && !validDate(d.date)) ||
      typeof d.title !== "string" ||
      !["draft", "completed", "historical"].includes(d.status) ||
      !Array.isArray(d.exercises)
    )
      throw Error("ครั้งฝึกไม่ถูกต้อง");
    const ids = new Set();
    for (const x of d.exercises) {
      const text = (v: unknown, max = 5000) =>
        v == null || (typeof v === "string" && v.length <= max);
      if (
        !x ||
        typeof x !== "object" ||
        typeof x.machineId !== "string" ||
        ids.has(x.machineId) ||
        !text(x.setup) ||
        !text(x.note) ||
        !Array.isArray(x.sets) ||
        x.sets.length > 100 ||
        x.sets.some(
          (s: any) =>
            !s ||
            typeof s !== "object" ||
            !num(s.load) ||
            !num(s.reps, 10000) ||
            (s.reps !== null && !Number.isInteger(s.reps)) ||
            !text(s.loadText, 200) ||
            (s.warmup != null && typeof s.warmup !== "boolean") ||
            typeof s.done !== "boolean",
        )
      )
        throw Error("ข้อมูลเซตไม่ถูกต้อง");
      ids.add(x.machineId);
    }
  }
  if (e.kind === "settings") {
    if (
      !Number.isInteger(d.cardioGoal) ||
      d.cardioGoal < 1 ||
      d.cardioGoal > 10080 ||
      !Number.isInteger(d.walkGoal) ||
      d.walkGoal < 1 ||
      d.walkGoal > 10080
    )
      throw Error("เป้าหมายต้องเป็นนาทีจำนวนเต็มมากกว่าศูนย์");
  }
  if (
    e.kind === "routine" &&
    (typeof d.title !== "string" ||
      !d.title.trim() ||
      !Array.isArray(d.machineIds) ||
      d.machineIds.some((id: unknown) => typeof id !== "string") ||
      new Set(d.machineIds).size !== d.machineIds.length ||
      !Array.isArray(d.days))
  )
    throw Error("โปรแกรมฝึกไม่ถูกต้อง");
}
