import { addDays, today, totalLoad, weekOf } from "./core";
import { musclesFor, type Muscle } from "./muscles";
import { isStretch } from "./stretchTraining";
import type { Entry, ExerciseLog, LoadMode, Machine, Session, SetLog } from "./types";

/** A confirmed set that counts. Stretches are left out by exercise, not by set. */
export const isWorkingSet = (set: SetLog) => set.done && !set.warmup;
const numeric = (mode: LoadMode) => mode === "total" || mode === "per-side";
export const setVolume = (set: SetLog, mode: LoadMode) =>
  numeric(mode) && set.load !== null && set.reps && set.meters == null ? totalLoad(set, mode)! * set.reps : 0;
/** Epley estimate; only used up to 12 repetitions, where it stays meaningful. */
export const estimatedMax = (set: SetLog, mode: LoadMode) =>
  numeric(mode) && set.load !== null && set.reps && set.reps <= 12 && set.meters == null
    ? totalLoad(set, mode)! * (set.reps === 1 ? 1 : 1 + set.reps / 30) : 0;
/** Reported results have no confirmed number of sets, so they never enter set or volume totals. */
const counted = (session: Session) => session.exercises.filter((x) => !x.reportedOnly && !isStretch(x.machineId));
export const exerciseVolume = (x: ExerciseLog) =>
  x.sets.filter(isWorkingSet).reduce((sum, set) => sum + setVolume(set, x.loadMode), 0);
export const sessionVolume = (session: Session) => counted(session).reduce((sum, x) => sum + exerciseVolume(x), 0);
export const sessionSets = (session: Session) =>
  counted(session).reduce((sum, x) => sum + x.sets.filter(isWorkingSet).length, 0);
/** Unknown when the workout has no start, or was clearly left open (over six hours). */
export function sessionMinutes(session: Session): number | undefined {
  if (!session.startedAt || !session.endedAt) return undefined;
  const minutes = Math.round((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60000);
  return minutes >= 1 && minutes <= 360 ? minutes : undefined;
}
export const minutesText = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} ชม. ${minutes % 60} น.` : `${minutes} นาที`;
export const kg = (value: number) =>
  `${value.toLocaleString("th-TH", { maximumFractionDigits: 1 })} กก.`;

type Before = { id: string; date: string; updatedAt?: string };
type Past = { set: SetLog; mode: LoadMode };
const finished = (e: Entry) => e.kind === "session" && !e.deleted && e.data.status !== "draft" && !!e.data.date;
const newestFirst = (a: Entry, b: Entry) =>
  b.data.date.localeCompare(a.data.date) || b.updatedAt.localeCompare(a.updatedAt);
function sessionsBefore(entries: Entry[], before: Before) {
  return entries.filter((e) => finished(e) && e.id !== before.id && (e.data.date < before.date ||
    (e.data.date === before.date && (!before.updatedAt || e.updatedAt < before.updatedAt)))).sort(newestFirst);
}
/** Every confirmed working set of one machine before a given workout. */
export function setsBefore(entries: Entry[], machineId: string, before: Before): Past[] {
  return sessionsBefore(entries, before).flatMap((e) => (e.data as Session).exercises
    .filter((x) => x.machineId === machineId)
    .flatMap((x) => x.sets.filter(isWorkingSet).map((set) => ({ set, mode: x.loadMode }))));
}
export function previousExercise(entries: Entry[], machineId: string, before: Before) {
  for (const entry of sessionsBefore(entries, before)) {
    const exercise = (entry.data as Session).exercises.find((x) => x.machineId === machineId && x.sets.some(isWorkingSet));
    if (exercise) return { date: entry.data.date as string, exercise };
  }
  return undefined;
}

export type RecordKind = "weight" | "max" | "volume" | "reps" | "assist" | "time" | "distance" | "added";
export const recordLabels: Record<RecordKind, string> = {
  weight: "น้ำหนักมากสุด",
  max: "1RM โดยประมาณ",
  volume: "ปริมาณต่อเซต",
  reps: "จำนวนครั้งมากสุด",
  assist: "ใช้แรงช่วยน้อยสุด",
  time: "เวลานานสุด",
  distance: "ระยะไกลสุด",
  added: "น้ำหนักเพิ่มมากสุด",
};
/** Which records a set beats. The first time on a machine is a starting point, not a record. */
export function setRecords(past: Past[], set: SetLog, mode: LoadMode): RecordKind[] {
  if (!isWorkingSet(set) || !set.reps) return [];
  const same = past.filter((p) => numeric(mode) ? numeric(p.mode) : p.mode === mode);
  if (set.meters != null && mode === "bodyweight")
    return same.length && set.meters > Math.max(0, ...same.map((p) => p.set.meters ?? 0)) ? ["distance"] : [];
  if (set.timed)
    return same.length && (set.holdSeconds ?? 0) > Math.max(0, ...same.map((p) => p.set.holdSeconds ?? 0)) ? ["time"] : [];
  if (mode === "bodyweight" && set.load)
    return same.length && set.load > Math.max(0, ...same.map((p) => p.set.load ?? 0)) ? ["added"] : [];
  if (mode === "bodyweight")
    return same.length && set.reps > Math.max(...same.map((p) => p.set.reps ?? 0)) ? ["reps"] : [];
  const known = same.filter((p) => p.set.load !== null);
  if (!known.length || set.load === null) return [];
  if (mode === "assistance")
    return set.load < Math.min(...known.map((p) => p.set.load!)) ? ["assist"] : [];
  const beats = (value: (p: Past) => number) =>
    value({ set, mode }) > Math.max(0, ...known.map(value)) + 1e-9;
  const kinds: RecordKind[] = [];
  if (beats((p) => totalLoad(p.set, p.mode)!)) kinds.push("weight");
  if (beats((p) => estimatedMax(p.set, p.mode))) kinds.push("max");
  if (beats((p) => setVolume(p.set, p.mode))) kinds.push("volume");
  return kinds;
}
/** Records of a finished workout: one per exercise and kind, against everything before it. */
export function sessionRecords(entries: Entry[], entry: Entry) {
  const session = entry.data as Session;
  return counted(session).flatMap((x) => {
    const past = setsBefore(entries, x.machineId, { id: entry.id, date: session.date, updatedAt: entry.updatedAt });
    const kinds = [...new Set(x.sets.flatMap((set) => setRecords(past, set, x.loadMode)))];
    return kinds.length ? [{ machineId: x.machineId, kinds }] : [];
  });
}
/** Best set and totals of an exercise compared with the previous time on the same machine. */
export function compareExercise(entries: Entry[], entry: Entry, x: ExerciseLog) {
  const previous = previousExercise(entries, x.machineId, { id: entry.id, date: entry.data.date, updatedAt: entry.updatedAt });
  if (!previous || x.reportedOnly || previous.exercise.reportedOnly) return undefined;
  const top = (log: ExerciseLog) => Math.max(0, ...log.sets.filter(isWorkingSet)
    .map((set) => numeric(log.loadMode) && set.load !== null ? totalLoad(set, log.loadMode)! : 0));
  const reps = (log: ExerciseLog) => log.sets.filter(isWorkingSet).reduce((sum, set) => sum + (set.reps ?? 0), 0);
  return {
    date: previous.date,
    weight: numeric(x.loadMode) && numeric(previous.exercise.loadMode) && top(x) && top(previous.exercise)
      ? top(x) - top(previous.exercise) : undefined,
    volume: exerciseVolume(x) && exerciseVolume(previous.exercise)
      ? exerciseVolume(x) - exerciseVolume(previous.exercise) : undefined,
    reps: reps(x) - reps(previous.exercise),
    sets: x.sets.filter(isWorkingSet).length - previous.exercise.sets.filter(isWorkingSet).length,
  };
}
/** Personal records of one machine, with the date each was set. */
export function machineRecords(entries: Entry[], machineId: string) {
  type Best = { value: number; date: string; reps: number };
  const out: { weight?: Best; max?: Best; volume?: Best; session?: Best; reps?: Best; time?: Best; distance?: Best; added?: Best; byReps: [number, Best][] } = { byReps: [] };
  const byReps = new Map<number, Best>();
  const better = (current: Best | undefined, value: number, date: string, reps: number) =>
    value > 0 && (!current || value > current.value + 1e-9) ? { value, date, reps } : current;
  for (const entry of entries.filter(finished).sort(newestFirst).reverse())
    for (const x of (entry.data as Session).exercises.filter((item) => item.machineId === machineId)) {
      const date = entry.data.date as string;
      for (const set of x.sets.filter(isWorkingSet)) {
        const reps = set.reps ?? 0;
        if (set.timed) out.time = better(out.time, set.holdSeconds ?? 0, date, reps);
        if (set.meters != null) out.distance = better(out.distance, set.meters, date, reps);
        if (x.loadMode === "bodyweight" && set.load) out.added = better(out.added, set.load, date, reps);
        if (x.loadMode === "bodyweight" && !set.timed && set.meters == null) out.reps = better(out.reps, reps, date, reps);
        if (!numeric(x.loadMode) || set.load === null || !reps) continue;
        const load = totalLoad(set, x.loadMode)!;
        out.weight = better(out.weight, load, date, reps);
        out.max = better(out.max, estimatedMax(set, x.loadMode), date, reps);
        out.volume = better(out.volume, setVolume(set, x.loadMode), date, reps);
        const rep = better(byReps.get(reps), load, date, reps);
        if (rep && set.meters == null) byReps.set(reps, rep);
      }
      if (!x.reportedOnly) out.session = better(out.session, exerciseVolume(x), date, 0);
    }
  out.byReps = [...byReps].sort(([a], [b]) => a - b);
  return out;
}

/** Sets per muscle: one for a main muscle, half for a helping muscle. */
export function muscleSets(entries: Entry[], sessions: Session[]) {
  const machines = new Map(entries.filter((e) => e.kind === "machine").map((e) => [e.id, e.data as Machine]));
  const sets: Partial<Record<Muscle, number>> = {};
  let unknown = 0;
  for (const session of sessions)
    for (const x of counted(session)) {
      const count = x.sets.filter(isWorkingSet).length;
      if (!count) continue;
      const { primary, secondary } = musclesFor(machines.get(x.machineId));
      if (!primary.length && !secondary.length) unknown += count;
      for (const muscle of primary) sets[muscle] = (sets[muscle] ?? 0) + count;
      for (const muscle of secondary) sets[muscle] = (sets[muscle] ?? 0) + count / 2;
    }
  return { sets, unknown };
}
export const finishedSessions = (entries: Entry[], from: string, to = today()) =>
  entries.filter((e) => finished(e) && e.data.date >= from && e.data.date <= to).map((e) => e.data as Session);
export function weeklyTraining(entries: Entry[], weeks = 12, now = today()) {
  return Array.from({ length: weeks }, (_, i) => addDays(weekOf(now), (i - weeks + 1) * 7)).map((week) => {
    const sessions = finishedSessions(entries, week, addDays(week, 6)).filter((s) => sessionSets(s) > 0);
    return {
      week,
      sessions: sessions.length,
      sets: sessions.reduce((sum, s) => sum + sessionSets(s), 0),
      volume: sessions.reduce((sum, s) => sum + sessionVolume(s), 0),
      minutes: sessions.reduce((sum, s) => sum + (sessionMinutes(s) ?? 0), 0),
    };
  });
}
/** Consecutive Sunday–Saturday weeks with any finished workout or confirmed cardio. A week still running never breaks it. */
export function trainingStreak(entries: Entry[], now = today()) {
  const weeks = new Set(entries.filter((e) => !e.deleted && e.data.date && e.data.date <= now &&
    (finished(e) || (e.kind === "cardio" && e.data.status === "confirmed"))).map((e) => weekOf(e.data.date)));
  let week = weekOf(now);
  if (!weeks.has(week)) week = addDays(week, -7);
  let streak = 0;
  for (; weeks.has(week); week = addDays(week, -7)) streak++;
  return streak;
}
/** Warm-up steps below a working load, rounded to plates that exist. */
export function warmupSets(load: number, step = 2.5) {
  return [[0.4, 10], [0.6, 6], [0.8, 3]]
    .map(([part, reps]) => ({ load: Math.round((load * part) / step) * step, reps }))
    .filter((set, i, all) => set.load > 0 && set.load < load && all.findIndex((x) => x.load === set.load) === i);
}
