import { describe, it, expect } from "vitest";
import { validateEntry, validDate } from "./validation";
describe("untrusted import validation", () => {
  it("rejects impossible calendar dates", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2028-02-29")).toBe(true);
  });
  it("rejects object text and file path identifiers", () => {
    expect(() =>
      validateEntry({ id: "../private", kind: "archive", data: { text: "x" } }),
    ).toThrow();
    expect(() =>
      validateEntry({
        id: "test",
        kind: "archive",
        data: { title: { html: "<script>" } },
      }),
    ).toThrow();
  });
  it("rejects zero goals and duplicate template machines", () => {
    expect(() =>
      validateEntry({
        id: "test",
        kind: "settings",
        data: { cardioGoal: 0, walkGoal: 150 },
      }),
    ).toThrow();
    expect(() =>
      validateEntry({
        id: "test",
        kind: "routine",
        data: { title: "x", machineIds: ["one", "one"], days: [] },
      }),
    ).toThrow();
  });
  it("accepts original load text but rejects malformed sets", () => {
    const session = (set: object) => ({
      id: "s",
      kind: "session" as const,
      data: {
        date: "2026-11-19",
        title: "x",
        status: "completed",
        exercises: [{ machineId: "m", setup: "", note: "", sets: [set] }],
      },
    });
    expect(() =>
      validateEntry(
        session({
          load: null,
          loadText: "13.5 กก. + 10 ที่หมุน",
          reps: 10,
          warmup: false,
          done: true,
        }),
      ),
    ).not.toThrow();
    expect(() =>
      validateEntry(
        session({ load: null, loadText: { x: 1 }, reps: 10, done: true }),
      ),
    ).toThrow();
    expect(() =>
      validateEntry(session({ load: -1, reps: 10, done: true })),
    ).toThrow();
  });
});
