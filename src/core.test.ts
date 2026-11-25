// Synthetic fixtures only. Real workout records are excluded from the repository.
import { describe, it, expect } from "vitest";
import {
  weekOf,
  parseTime,
  cardioTotals,
  clientSummary,
  coachMessage,
  latestExercise,
  ocrCandidates,
  duration,
  bestSet,
  machineHistory,
} from "./core";
import type { Entry, Cardio } from "./types";
const log = (id: string, patch: Partial<Cardio> = {}): Entry => ({
  id,
  kind: "cardio",
  updatedAt: "2026-11-19T12:00:00Z",
  version: 0,
  dirty: true,
  data: {
    date: "2026-11-19",
    week: "2026-11-15",
    activity: "เดินลู่วิ่ง",
    seconds: 60,
    distance: null,
    speed: null,
    incline: null,
    kcal: null,
    status: "confirmed",
    walkGoal: true,
    note: "",
    ...patch,
  },
});
const machine = (id: string, name: string, loadMode = "total"): Entry => ({
  id,
  kind: "machine",
  updatedAt: "",
  version: 0,
  dirty: false,
  data: { name, loadMode },
});
describe("time and reporting", () => {
  it("a report for yesterday does not include a later workout", () => {
    const m = coachMessage(
      [
        log("y", { date: "2026-11-18", seconds: 5405 }),
        log("today", { activity: "ต่อยมวย", seconds: 3600, walkGoal: false }),
      ],
      "2026-11-18",
      "2026-11-15",
      150,
    );
    expect(m).toContain("90 นาที 05 วินาที");
    expect(m).not.toContain("สะสมแล้ว: 150 นาที");
    expect(m).not.toContain("ต่อยมวย");
  });
  it("preserves seconds and accepts hours", () => {
    expect(parseTime("35:17")).toBe(2117);
    expect(parseTime("2:03:04")).toBe(7384);
    expect(duration(3600)).toBe("1 ชั่วโมง 0 นาที 0 วินาที");
  });
  it.each([
    "",
    "abc",
    "12:60",
    "1:60:00",
    "-1:12",
    "0:00",
    "1:02:03:04",
    "1.5:30",
    "1::20",
    "1:2",
    "25:00:00",
  ])("rejects malformed duration %s", (t) =>
    expect(() => parseTime(t)).toThrow(),
  );
  it("uses Sunday to Saturday including year boundary", () => {
    expect(weekOf("2026-11-19")).toBe("2026-11-15");
    expect(weekOf("2027-01-01")).toBe("2026-12-27");
  });
  it("aggregates activities while keeping the walking goal separate", () => {
    const entries = [
      log("walk", { date: "2026-11-18", seconds: 5405, distance: 6.7 }),
      log("boxing", { activity: "ต่อยมวย", seconds: 3600, walkGoal: false }),
    ];
    expect(cardioTotals(entries, "2026-11-15").seconds).toBe(9005);
    const m = coachMessage(entries, "2026-11-19", "2026-11-15", 150);
    expect(m).toContain("100.1%");
    expect(m).toContain("ต่อยมวย");
    expect(cardioTotals(entries, "2026-11-15", true).seconds).toBe(5405);
  });
  it("does not count deleted, pending or another credited week", () => {
    expect(
      cardioTotals(
        [
          log("a"),
          log("b", { status: "review" }),
          { ...log("c"), deleted: true },
          log("d", { week: "2026-11-08" }),
        ],
        "2026-11-15",
      ).seconds,
    ).toBe(60);
  });
  it("credits a catch-up to chosen week without moving actual date", () => {
    const e = log("catch-up", {
      date: "2026-11-17",
      week: "2026-11-08",
      seconds: 2490,
    });
    expect(cardioTotals([e], "2026-11-08").seconds).toBe(2490);
    expect(coachMessage([e], "2026-11-17", "2026-11-08", 150)).toContain(
      "ชดเชย",
    );
  });
  it("does not duplicate day totals or invent unknown distances", () => {
    const m = coachMessage(
      [
        log("a", { seconds: 900, distance: 1.2 }),
        log("b", { seconds: 2400, distance: 3.1 }),
      ],
      "2026-11-19",
      "2026-11-15",
      150,
    );
    expect(m).toContain("รวม: 55 นาที 00 วินาที");
    expect(m).toContain("4.30");
    expect(m).not.toContain("kcal");
  });
  it("formats the trainer report like the coach expects", () => {
    const es: Entry[] = [
      log("walk", { date: "2026-11-18", seconds: 6500, distance: 8 }),
      log("boxing", { activity: "ต่อยมวย", seconds: 3600, walkGoal: false }),
      machine("chest", "Chest Press", "per-side"),
      machine("hip", "Hip Abduction"),
      {
        id: "s",
        kind: "session",
        updatedAt: "",
        version: 0,
        dirty: false,
        data: {
          date: "2026-11-19",
          status: "completed",
          exercises: [
            {
              machineId: "chest",
              loadMode: "per-side",
              setup: "เบาะระดับ 6",
              note: "",
              sets: [
                { id: "1", load: 10, reps: 12, warmup: false, done: true },
              ],
            },
            {
              machineId: "hip",
              loadMode: "total",
              setup: "",
              note: "",
              sets: [
                {
                  id: "2",
                  load: null,
                  loadText: "13.5 กก. + 10 ที่หมุน",
                  reps: 10,
                  warmup: false,
                  done: true,
                },
              ],
            },
          ],
        },
      },
    ];
    const m = coachMessage(
      es,
      "2026-11-19",
      "2026-11-15",
      150,
      false,
      true,
      "2026-11-19",
    );
    expect(m.startsWith("🥊 อัปเดตคาร์ดิโอ (ต่อยมวย)\nวันนี้: 60 นาที 00 วินาที")).toBe(
      true,
    );
    expect(m).toContain("✅ สะสมแล้ว: 168 นาที 20 วินาที");
    expect(m).toContain("📈 ทำได้แล้ว: 112.2%");
    expect(m).toContain("เกินมา 18 นาที 20 วินาที");
    expect(m).toContain("1. Chest Press: 20 กก. (ข้างละ 10) × 12 ครั้ง");
    expect(m).not.toContain("ตั้งเครื่อง");
    expect(m).toContain("2. Hip Abduction: 13.5 กก. + 10 ที่หมุน × 10 ครั้ง");
    expect(m).not.toContain("เซต");
  });
  it("keeps the best set separate from the latest result", () => {
    const mk = (id: string, date: string, load: number): Entry => ({
      id,
      kind: "session",
      updatedAt: date,
      version: 0,
      dirty: false,
      data: {
        date,
        status: "completed",
        exercises: [
          {
            machineId: "m",
            loadMode: "total",
            sets: [{ id, load, reps: 10, warmup: false, done: true }],
          },
        ],
      },
    });
    const es = [mk("a", "2026-11-01", 40), mk("b", "2026-11-10", 30)];
    expect(latestExercise(es, "m", "2026-11-19")?.entry.id).toBe("b");
    expect(bestSet(es, "m")?.set.load).toBe(40);
    expect(machineHistory(es, "m").map((h) => h.entry.id)).toEqual(["b", "a"]);
  });
  it("retains multiple OCR candidates for manual confirmation", () => {
    expect(ocrCandidates("TIME 35:17 PACE 12:30 DISTANCE 2.35").times).toEqual([
      "35:17",
      "12:30",
    ]);
    expect(ocrCandidates("TIME 35:17 DISTANCE 2.35").distances).toEqual([2.35]);
  });
  it("latest result is by date and machine, never highest weight or a draft", () => {
    const session = (
      id: string,
      date: string,
      weight: number,
      status = "completed",
      machineId = "we",
    ): Entry => ({
      id,
      kind: "session",
      updatedAt: date + "T12:00:00Z",
      version: 0,
      dirty: false,
      data: {
        date,
        status,
        exercises: [
          { machineId, sets: [{ load: weight, reps: 12, done: true }] },
        ],
      },
    });
    const es = [
      session("old", "2026-11-10", 35),
      session("current", "2026-11-19", 30),
      session("draft", "2026-11-19", 20, "draft"),
      session("other", "2026-11-19", 50, "completed", "jett"),
    ];
    expect(latestExercise(es, "we", "2026-11-19")?.entry.id).toBe("current");
    expect(latestExercise(es, "we", "2026-11-19", "current")?.entry.id).toBe(
      "old",
    );
  });
});
it("summarizes one client's week with the same rules the client sees", () => {
  const meta = { version: 1, updatedAt: "2026-11-25T00:00:00Z", dirty: false };
  const session = (id: string, date: string, status: string, machineIds: string[], deleted = false): any => ({
    ...meta, id, kind: "session", deleted,
    data: { date, status, title: id, exercises: machineIds.map((machineId) => ({ machineId, sets: [] })) },
  });
  const cardio = (id: string, date: string, week: string, seconds: number, status = "confirmed"): any => ({
    ...meta, id, kind: "cardio", data: { date, week, seconds, status, activity: "เดิน", distance: null },
  });
  const summary = clientSummary([
    { ...meta, id: "settings-main", kind: "settings", data: { cardioGoal: 120 } } as any,
    session("strength", "2026-11-23", "completed", ["we-chest"]),
    session("mixed", "2026-11-24", "completed", ["we-chest", "home-stretch-doorway"]),
    session("stretch", "2026-11-24", "completed", ["home-stretch-doorway"]),
    session("draft", "2026-11-25", "draft", ["we-chest"]),
    session("trashed", "2026-11-25", "completed", ["we-chest"], true),
    session("old", "2026-11-14", "completed", ["we-chest"]),
    cardio("now", "2026-11-22", "2026-11-22", 1205),
    cardio("made-up-for-last-week", "2026-11-23", "2026-11-15", 600),
    cardio("unchecked", "2026-11-25", "2026-11-22", 900, "review"),
    { ...meta, id: "body", kind: "body", data: { date: "2026-11-20", weight: 70.5 } } as any,
    { ...meta, id: "body-waist", kind: "body", data: { date: "2026-11-21", weight: null, waist: 80 } } as any,
  ], "2026-11-25");
  expect(summary).toEqual({
    goal: 120, cardioSeconds: 1205, strength: 2, stretch: 2, lastDate: "2026-11-24",
    weight: { value: 70.5, date: "2026-11-20" },
  });
  expect(clientSummary([], "2026-11-25")).toEqual({
    goal: 150, cardioSeconds: 0, strength: 0, stretch: 0, lastDate: undefined, weight: undefined,
  });
});
