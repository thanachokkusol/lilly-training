import { expect, it } from "vitest";
import { cardioTotals, parseTime } from "./core";
import type { Entry } from "./types";

it("preserves weekly totals, including compensation, and excludes review and deleted records", () => {
  const rounds = [
    ["2026-11-01", ["33:19", "30:00", "34:09", "53:32"], "151:00"],
    ["2026-11-08", ["30:00", "41:38", "21:27", "60:00"], "153:05"],
    ["2026-11-15", ["60:00", "121:14"], "181:14"],
    ["2026-11-22", ["20:05"], "20:05"],
  ] as const;
  const entries = rounds.flatMap(([week, durations]) =>
    durations.map((duration, i): Entry => ({
      id: `${week}-${i}`, kind: "cardio", version: 1, updatedAt: "", dirty: false,
      data: {
        date: week === "2026-11-08" && i === 3 ? "2026-11-17" : week,
        week, status: "confirmed", seconds: parseTime(duration),
      },
    })),
  );
  const base = entries[0];
  entries.push(
    { ...base, id: "review", data: { ...base.data, status: "review" } },
    { ...base, id: "deleted", deleted: true },
  );
  for (const [week, , expected] of rounds) {
    expect(cardioTotals(entries, week).seconds).toBe(parseTime(expected));
  }
});
