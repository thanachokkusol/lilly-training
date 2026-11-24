import type { Entry, Session, LoadMode, SetLog, ExerciseLog, Machine } from "./types";

export const exerciseKey = (machine: Machine) =>
  machine.exerciseId ?? machine.name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

export function machinePhotoIds(entries: Entry[], machineId: string, machine: Machine) {
  const jettPhotos = new Set(entries.flatMap((e) =>
    e.kind === "machine" && !e.deleted && e.data.gym === "Jett" && e.data.photoId ? [e.data.photoId] : [],
  ));
  const belongs = (id: string) =>
    machine.gym === "Jett" || (!id.startsWith("photo-jett-") && !jettPhotos.has(id));
  const photos = entries.filter((e) => e.kind === "photo" && !e.deleted && belongs(e.id) &&
    (e.data.machineId === machineId || e.id === machine.photoId || e.id === machine.referencePhotoId ||
      e.id === `photo-${machineId}` ||
      (machine.gym === "Jett" && e.id === `photo-${machineId.replace(/^jett-/, "jett-ref-")}`)));
  const preferred = [machine.photoId, machine.referencePhotoId].filter(
    (id): id is string => !!id && belongs(id) && !entries.some((e) => e.id === id && e.deleted),
  );
  return { photos, main: preferred[0] ?? photos.find((photo) => !photo.id.startsWith("guide-photo-"))?.id ?? photos[0]?.id };
}

export function exerciseProgress(entries: Entry[], machineIds: string[]) {
  const allowed = new Set(machineIds);
  const previous = new Map<string, number>();
  let index = 1;
  return entries
    .filter((e) => e.kind === "session" && !e.deleted && e.data.date && e.data.status !== "draft")
    .sort((a, b) => a.data.date.localeCompare(b.data.date) || a.updatedAt.localeCompare(b.updatedAt))
    .flatMap((entry) => {
      const results = new Map<string, { best: { kg: number; reps: number; estimate: number }; heaviest: { kg: number; reps: number } }>();
      for (const exercise of (entry.data as Session).exercises) {
        if (!allowed.has(exercise.machineId) || !["total", "per-side"].includes(exercise.loadMode)) continue;
        for (const set of exercise.sets) {
          if (!set.done || set.warmup || set.load === null || set.load <= 0 || !set.reps || set.reps <= 0) continue;
          const kg = totalLoad(set, exercise.loadMode)!;
          const point = { kg, reps: set.reps, estimate: kg * (1 + set.reps / 30) };
          const result = results.get(exercise.machineId);
          results.set(exercise.machineId, {
            best: result && result.best.estimate >= point.estimate ? result.best : point,
            heaviest: result && result.heaviest.kg >= kg ? result.heaviest : point,
          });
        }
      }
      return Array.from(results, ([machineId, { best, heaviest }]) => {
        const baseline = previous.get(machineId);
        if (baseline !== undefined) index *= best.estimate / baseline;
        previous.set(machineId, best.estimate);
        return { date: entry.data.date as string, machineId, percent: (index - 1) * 100, best, heaviest };
      });
    });
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekOf(date: string) {
  return addDays(date, -new Date(date + "T12:00:00Z").getUTCDay());
}
const octoberWalks: Record<string, [string, string, number]> = {
  "EX-20261016-02": ["2026-10-16", "2026-10-12", 3600],
  "EX-20261018-02": ["2026-10-18", "2026-10-12", 1800],
  "WALK-20261028-01": ["2026-10-28", "2026-10-26", 1907],
  "WALK-20261029-01": ["2026-10-29", "2026-10-26", 2070],
};
export function octoberWalkWeek(entry: Entry) {
  const original = octoberWalks[entry.id];
  if (!original || entry.kind !== "cardio" || entry.deleted || entry.conflict) return undefined;
  const [date, week, seconds] = original;
  const data = entry.data;
  if (data.date !== date || data.week !== week || data.seconds !== seconds || data.status !== "confirmed")
    return undefined;
  return weekOf(date);
}
export const dateLabel = (d: string) =>
  d
    ? new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(d + "T12:00:00Z"))
    : "ไม่ทราบวัน";
export const duration = (s: number) => {
  const n = Math.max(0, Math.round(s));
  return `${Math.floor(n / 3600) ? `${Math.floor(n / 3600)} ชั่วโมง ` : ""}${Math.floor((n % 3600) / 60)} นาที ${n % 60} วินาที`;
};
export function timeInput(s: number) {
  return `${Math.floor(s / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
export function parseTime(v: string) {
  if (!/^\d{1,4}:\d{2}(?::\d{2})?$/.test(v.trim()))
    throw Error("กรอกเวลา mm:ss หรือ hh:mm:ss เช่น 35:17 หรือ 2:03:04");
  const p = v.trim().split(":").map(Number);
  if (
    ![2, 3].includes(p.length) ||
    p.some((n) => !Number.isInteger(n) || n < 0) ||
    p.at(-1)! >= 60 ||
    (p.length === 3 && p[1] >= 60)
  )
    throw Error("กรอกเวลา mm:ss หรือ hh:mm:ss เช่น 34:09 หรือ 2:01:14");
  const s = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  if (!s || s > 86400) throw Error("เวลาต้องมากกว่าศูนย์และไม่เกิน 24 ชั่วโมง");
  return s;
}
export const loadLabel = (mode: LoadMode) =>
  ({
    "per-side": "กก./ข้าง",
    total: "กก.",
    assistance: "กก. แรงช่วย",
    bodyweight: "น้ำหนักตัว",
  })[mode];
export const totalLoad = (set: SetLog, mode: LoadMode) =>
  set.load === null ? null : set.load * (!set.enteredAs && mode === "per-side" ? 2 : 1);
export const loadText = (s: SetLog, mode: LoadMode) =>
  mode === "bodyweight"
    ? "น้ำหนักตัว"
    : s.load !== null
      ? mode === "assistance"
        ? `${s.load} ${loadLabel(mode)}`
        : `${totalLoad(s, mode)} กก.${(s.enteredAs === "perSide" || (!s.enteredAs && mode === "per-side")) ? ` (ข้างละ ${totalLoad(s, mode)! / 2})` : ""}`
      : s.loadText?.trim() || "ไม่ทราบน้ำหนัก";
export const formatSet = (s: SetLog, mode: LoadMode) =>
  `${loadText(s, mode)} × ${s.reps ?? "ไม่ทราบ"} ครั้ง`;
/** A set has a usable load when it is bodyweight, numeric, or kept as the original text. */
export const hasLoad = (s: SetLog, mode: LoadMode) =>
  mode === "bodyweight" || s.load !== null || !!s.loadText?.trim();
export function latestExercise(
  entries: Entry[],
  machineId: string,
  beforeDate: string,
  excludeId?: string,
) {
  return entries
    .filter(
      (e) =>
        e.kind === "session" &&
        !e.deleted &&
        e.id !== excludeId &&
        e.data.status !== "draft" &&
        e.data.date &&
        e.data.date <= beforeDate,
    )
    .sort(
      (a, b) =>
        b.data.date.localeCompare(a.data.date) ||
        b.updatedAt.localeCompare(a.updatedAt),
    )
    .map((e) => ({
      entry: e,
      exercise: (e.data as Session).exercises.find(
        (x) => x.machineId === machineId,
      ),
    }))
    .find((x) => x.exercise && x.exercise.sets.some((s) => s.done));
}
type Done = { entry: Entry; exercise: ExerciseLog };
/** Every confirmed result for a machine, newest first. */
export function machineHistory(entries: Entry[], machineId: string): Done[] {
  return entries
    .filter(
      (e) =>
        e.kind === "session" &&
        !e.deleted &&
        e.data.status !== "draft" &&
        e.data.date,
    )
    .sort(
      (a, b) =>
        b.data.date.localeCompare(a.data.date) ||
        b.updatedAt.localeCompare(a.updatedAt),
    )
    .flatMap((e) => {
      const exercise = (e.data as Session).exercises.find(
        (x) => x.machineId === machineId && x.sets.some((s) => s.done),
      );
      return exercise ? [{ entry: e, exercise }] : [];
    });
}
/** Heaviest confirmed working set (lowest for assistance machines). Never replaces the latest result. */
export function bestSet(entries: Entry[], machineId: string) {
  let best: { date: string; set: SetLog; mode: LoadMode } | null = null;
  for (const h of machineHistory(entries, machineId))
    for (const s of h.exercise.sets) {
      if (!s.done || s.warmup || s.load === null) continue;
      const load = totalLoad(s, h.exercise.loadMode)!;
      const bestLoad = best ? totalLoad(best.set, best.mode)! : 0;
      const better =
        !best ||
        (h.exercise.loadMode === "assistance"
          ? load < bestLoad
          : load > bestLoad) ||
        (load === bestLoad && (s.reps ?? 0) > (best.set.reps ?? 0));
      if (better)
        best = { date: h.entry.data.date, set: s, mode: h.exercise.loadMode };
    }
  return best;
}
export function cardioTotals(
  entries: Entry[],
  week: string,
  walking = false,
  throughDate?: string,
) {
  const logs = entries.filter(
    (e) =>
      e.kind === "cardio" &&
      !e.deleted &&
      e.data.status === "confirmed" &&
      e.data.week === week &&
      (!throughDate || e.data.date <= throughDate) &&
      (!walking || e.data.walkGoal),
  );
  return {
    seconds: logs.reduce((s, e) => s + e.data.seconds, 0),
    distance: logs.reduce((s, e) => s + (e.data.distance ?? 0), 0),
    unknownDistance: logs.some((e) => e.data.distance === null),
    count: logs.length,
  };
}
export const minuteDuration = (s: number) => {
  const n = Math.max(0, Math.round(s));
  return `${Math.floor(n / 60)} นาที ${(n % 60).toString().padStart(2, "0")} วินาที`;
};
const activityEmoji = (a: string) =>
  a.includes("มวย")
    ? "🥊"
    : a.includes("เดิน")
      ? "🚶"
      : a.includes("วิ่ง")
        ? "🏃"
        : a.includes("จักรยาน")
          ? "🚴"
          : a.includes("แบด")
            ? "🏸"
            : "🔥";
const slashDate = (d: string) => d.split("-").reverse().join("/");
/** One line per exercise done on `date`: name, load × reps, and optional training notes. */
export function weightLines(entries: Entry[], date: string) {
  const sessions = entries.filter(
    (e) =>
      e.kind === "session" &&
      !e.deleted &&
      e.data.status !== "draft" &&
      e.data.date === date,
  );
  const lines: string[] = [];
  for (const e of sessions)
    for (const x of (e.data as Session).exercises) {
      const done = x.sets.filter((s) => s.done);
      if (!done.length) continue;
      const m = entries.find((m) => m.id === x.machineId)?.data;
      const sets = done
        .map(
          (s) =>
            `${loadText(s, x.loadMode)} × ${s.reps ?? "ไม่ทราบ"} ครั้ง${s.warmup ? " (วอร์ม)" : ""}`,
        )
        .join(" / ");
      let line = `${lines.length + 1}. ${m?.name ?? "เครื่อง"}: ${sets}`;
      // Notes on imported "reported only" results are provenance, not coach info.
      if (x.note?.trim() && !x.reportedOnly)
        line += `\n   โน้ต: ${x.note.trim()}`;
      lines.push(line);
    }
  return lines;
}
export function coachMessage(
  entries: Entry[],
  date: string,
  week: string,
  goalMinutes: number,
  walking = false,
  includeWeights = true,
  now = today(),
) {
  const logs = entries
    .filter(
      (e) =>
        e.kind === "cardio" &&
        !e.deleted &&
        e.data.status === "confirmed" &&
        e.data.date === date &&
        e.data.week === week &&
        (!walking || e.data.walkGoal),
    )
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const totals = cardioTotals(entries, week, walking, date),
    sec = logs.reduce((s, e) => s + e.data.seconds, 0),
    goal = goalMinutes * 60,
    dayWord = date === now ? "วันนี้" : `วันที่ ${slashDate(date)}`,
    activities = [...new Set(logs.map((e) => e.data.activity as string))];
  const parts: string[] = [];
  if (logs.length) {
    let head = `${activityEmoji(activities[0])} ${walking ? "อัปเดตการเดิน" : "อัปเดตคาร์ดิโอ"} (${activities.join(" + ")})`;
    const detail = logs.map((e) => ({
      activity: e.data.activity as string,
      time: minuteDuration(e.data.seconds),
      extra: [
        e.data.distance !== null ? `ระยะ ${e.data.distance} กม.` : "",
        e.data.speed !== null ? `ความเร็ว ${e.data.speed} กม./ชม.` : "",
        e.data.incline !== null ? `ชัน ${e.data.incline}%` : "",
        e.data.kcal !== null ? `${e.data.kcal} kcal ตามเครื่อง` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    }));
    if (logs.length === 1) {
      head += `\n${dayWord}: ${detail[0].time}`;
      if (detail[0].extra) head += `\n${detail[0].extra}`;
    } else {
      head += `\n${dayWord}:`;
      for (const d of detail)
        head += `\n• ${d.activity} ${d.time}${d.extra ? ` (${d.extra})` : ""}`;
      head += `\nรวม: ${minuteDuration(sec)}`;
    }
    parts.push(head);
  } else
    parts.push(
      `${walking ? "🚶 อัปเดตการเดิน" : "🏃 อัปเดตคาร์ดิโอ"}\n${dayWord}: ยังไม่มีรายการที่ยืนยัน`,
    );
  const lines = [
    `📊 รอบสัปดาห์ ${dateLabel(week)} – ${dateLabel(addDays(week, 6))}`,
    `🎯 เป้าหมาย${walking ? "เดิน" : ""}: ${goalMinutes} นาที`,
    `✅ สะสมแล้ว: ${minuteDuration(totals.seconds)}`,
    `📈 ทำได้แล้ว: ${((totals.seconds / goal) * 100).toFixed(1)}%`,
    totals.seconds >= goal
      ? `🏁 ครบเป้าแล้ว${totals.seconds > goal ? ` เกินมา ${minuteDuration(totals.seconds - goal)}` : ""}`
      : `⌛ เหลืออีก ${minuteDuration(goal - totals.seconds)}`,
  ];
  if (totals.distance)
    lines.push(
      `📍 ระยะ${totals.unknownDistance ? "ที่บันทึก" : ""}สะสม: ${totals.distance.toFixed(2)} กม.`,
    );
  if (logs.length && week !== weekOf(date))
    lines.push(`หมายเหตุ: รายการ${dayWord}นับชดเชยให้รอบสัปดาห์นี้`);
  parts.push(lines.join("\n"));
  if (includeWeights) {
    const w = weightLines(entries, date);
    if (w.length)
      parts.push(`🏋️ เวท${dayWord} (${w.length} ท่า)\n${w.join("\n")}`);
  }
  return parts.join("\n\n");
}
export function ocrCandidates(text: string) {
  const normalized = text
    .replace(/[Oo](?=\d|:)/g, "0")
    .replace(/(\d)\s*:\s*(\d)/g, "$1:$2");
  const times = [
    ...new Set(normalized.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g) || []),
  ].filter((t) => {
    try {
      parseTime(t);
      return true;
    } catch {
      return false;
    }
  });
  const distances = [
    ...new Set(
      [
        ...normalized.matchAll(
          /(?:distance|ระยะ(?:ทาง)?)\D{0,18}(\d{1,2}[.,]\d{1,3})/gi,
        ),
      ].map((m) => Number(m[1].replace(",", "."))),
    ),
  ];
  return { times, distances };
}
