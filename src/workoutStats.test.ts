import { describe, expect, it } from "vitest";
import { homeMoves } from "./homeTraining";
import { musclesFor } from "./muscles";
import { compareExercise, estimatedMax, machineRecords, muscleSets, sessionMinutes, sessionRecords, sessionSets,
  sessionVolume, setRecords, trainingStreak, warmupSets, weeklyTraining } from "./workoutStats";
import type { Entry, LoadMode, SetLog } from "./types";

const set = (load: number | null, reps: number, extra: Partial<SetLog> = {}): SetLog =>
  ({ id: `${load}-${reps}`, load, reps, warmup: false, done: true, ...extra });
const exercise = (machineId: string, sets: SetLog[], loadMode: LoadMode = "total", extra = {}) =>
  ({ machineId, sets, loadMode, note: "", setup: "", ...extra });
const session = (id: string, date: string, exercises: any[], extra = {}): Entry => ({
  id, kind: "session", version: 1, dirty: false, updatedAt: `${date}T10:00:00Z`,
  data: { date, title: id, status: "completed", note: "", exercises, ...extra },
});
const machine = (id: string, name: string, group = "อื่น ๆ"): Entry =>
  ({ id, kind: "machine", version: 1, dirty: false, updatedAt: "", data: { name, group, gym: "WE Fitness", setup: "", loadMode: "total" } });

describe("totals", () => {
  it("counts every confirmed set, an old warm-up flag included, and both sides of a per-side load", () => {
    const data = session("a", "2026-11-20", [
      exercise("press", [set(10, 12), set(10, 12, { warmup: true }), set(10, 12, { done: false })], "per-side"),
      exercise("row", [set(30, 10)]),
      exercise("reported", [set(50, 10)], "total", { reportedOnly: true }),
      exercise("home-stretch-doorway", [set(null, 3, { holdSeconds: 10 })], "bodyweight"),
      exercise("push", [set(null, 20)], "bodyweight"),
    ]).data;
    expect(sessionVolume(data)).toBe(2 * 20 * 12 + 300);
    expect(sessionSets(data)).toBe(4);
  });
  it("leaves the duration unknown without a start or when the workout was left open", () => {
    const base = session("a", "2026-11-20", []).data;
    expect(sessionMinutes(base)).toBeUndefined();
    expect(sessionMinutes({ ...base, startedAt: "2026-11-20T10:00:00Z", endedAt: "2026-11-20T10:55:00Z" })).toBe(55);
    expect(sessionMinutes({ ...base, startedAt: "2026-11-20T10:00:00Z", endedAt: "2026-11-21T10:00:00Z" })).toBeUndefined();
  });
});

describe("records", () => {
  const past = [{ set: set(30, 10), mode: "total" as const }];
  it("finds weight, estimated max and volume records, and none the first time", () => {
    expect(setRecords([], set(30, 10), "total")).toEqual([]);
    expect(setRecords(past, set(30, 10), "total")).toEqual([]);
    expect(setRecords(past, set(32.5, 10), "total")).toEqual(["weight", "max", "volume"]);
    expect(setRecords(past, set(32.5, 3), "total")).toEqual(["weight"]);
    expect(setRecords(past, set(30, 12), "total")).toEqual(["max", "volume"]);
    expect(setRecords(past, set(40, 10, { warmup: true }), "total")).toEqual(["weight", "max", "volume"]);
  });
  it("compares per-side entries with totals by their real load", () => {
    expect(setRecords(past, set(15, 10), "per-side")).toEqual([]);
    expect(setRecords(past, set(16, 10), "per-side")).toContain("weight");
  });
  it("treats less assistance as better and bodyweight by repetitions", () => {
    expect(setRecords([{ set: set(40, 8), mode: "assistance" }], set(35, 8), "assistance")).toEqual(["assist"]);
    expect(setRecords([{ set: set(40, 8), mode: "assistance" }], set(45, 8), "assistance")).toEqual([]);
    expect(setRecords([{ set: set(null, 10), mode: "bodyweight" }], set(null, 12), "bodyweight")).toEqual(["reps"]);
  });
  it("estimates one repetition only where the formula holds", () => {
    expect(estimatedMax(set(100, 1), "total")).toBe(100);
    expect(estimatedMax(set(30, 10), "total")).toBe(40);
    expect(estimatedMax(set(30, 20), "total")).toBe(0);
  });
  it("uses only earlier workouts on the same machine", () => {
    const entries = [
      session("old", "2026-11-10", [exercise("press", [set(25, 12)])]),
      session("other", "2026-11-12", [exercise("press-m", [set(90, 12)])]),
      session("now", "2026-11-20", [exercise("press", [set(30, 12), set(30, 12)])]),
      session("later", "2026-11-22", [exercise("press", [set(50, 12)])]),
    ];
    expect(sessionRecords(entries, entries[2])).toEqual([{ machineId: "press", kinds: ["weight", "max", "volume"] }]);
    expect(compareExercise(entries, entries[2], entries[2].data.exercises[0]))
      .toEqual({ date: "2026-11-10", weight: 5, volume: 720 - 300, reps: 12, sets: 1 });
    const records = machineRecords(entries, "press");
    expect(records.weight).toEqual({ value: 50, date: "2026-11-22", reps: 12 });
    expect(records.session).toEqual({ value: 720, date: "2026-11-20", reps: 0 });
    expect(records.byReps).toEqual([[12, { value: 50, date: "2026-11-22", reps: 12 }]]);
  });
});

describe("muscles", () => {
  it("knows every bundled home exercise", () => {
    expect(homeMoves.filter((move) => !musclesFor(move).primary.length).map(({ name }) => name)).toEqual([]);
  });
  it.each([
    ["Chest Press", "อก", ["chest"]], ["Triceps Pushdown", "แขน", ["triceps"]], ["Seated Cable Row", "หลัง", ["upper_back"]],
    ["Close-Grip Lat Pulldown", "หลัง", ["lats"]], ["Rear Delt Fly", "ไหล่", ["shoulders"]], ["Leg Press", "ขา", ["quadriceps"]],
    ["Hip Abduction", "ขา", ["abductors"]], ["Leg Extension / Leg Curl", "ขา", ["quadriceps", "hamstrings"]],
    ["Doorway Chest Stretch", "Stretch", []], ["เครื่องถีบขาหลัง", "ขา", []], ["Incline Press", "อก", ["chest"]],
    ["T-Bar Row (Chest-Supported)", "หลัง", ["upper_back"]], ["Hammer Curl", "แขน", ["biceps"]],
  ])("maps %s", (name, group, primary) => {
    expect(musclesFor({ name, group }).primary).toEqual(primary);
  });
  it("prefers the muscles the owner picked", () => {
    expect(musclesFor({ name: "Chest Press", group: "อก", trains: { primary: ["triceps"], secondary: [] } }).primary).toEqual(["triceps"]);
    // Corrections saved before the universal list still count.
    expect(musclesFor({ name: "Chest Press", group: "อก", muscles: { primary: ["deltoids"], secondary: ["gluteal", "abs", "obliques"] } }))
      .toEqual({ primary: ["shoulders"], secondary: ["glutes", "abdominals"] });
  });
  it("adds a full set to main muscles, half to helping muscles, and reports unknown ones", () => {
    const entries = [machine("press", "Chest Press", "อก"), machine("x", "เครื่องใหม่", "ขา")];
    const { sets, unknown } = muscleSets(entries, [session("a", "2026-11-20", [
      exercise("press", [set(20, 10), set(20, 10)]), exercise("x", [set(20, 10)])]).data]);
    expect(sets).toEqual({ chest: 2, triceps: 1, shoulders: 1 });
    expect(unknown).toBe(1);
  });
});

it("builds weekly training and keeps a streak through the running week", () => {
  const entries = [
    session("w1", "2026-11-10", [exercise("a", [set(10, 10)])]),
    session("w2", "2026-11-19", [exercise("a", [set(20, 10)])], { startedAt: "2026-11-19T10:00:00Z", endedAt: "2026-11-19T11:00:00Z" }),
  ];
  const weeks = weeklyTraining(entries, 3, "2026-11-25");
  expect(weeks.map((w) => [w.week, w.sessions, w.sets, w.volume, w.minutes])).toEqual([
    ["2026-11-08", 1, 1, 100, 0], ["2026-11-15", 1, 1, 200, 60], ["2026-11-22", 0, 0, 0, 0]]);
  expect(trainingStreak(entries, "2026-11-25")).toBe(2);
  expect(trainingStreak(entries, "2026-12-02")).toBe(0);
});
it("suggests rounded warm-up sets below the working load", () => {
  expect(warmupSets(50)).toEqual([{ load: 20, reps: 10 }, { load: 30, reps: 6 }, { load: 40, reps: 3 }]);
  expect(warmupSets(2.5)).toEqual([]);
});
