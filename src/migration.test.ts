import { expect, it } from "vitest";
import { planSessionMove } from "./migration";
import type { Entry, Machine } from "./types";

it("moves reviewed sets without changing their count and rejects a conflicting venue code", () => {
  const machine: Machine = {
    name: "Chest Press", thai: "", gym: "M Fitness", group: "อก",
    setup: "", cues: "", loadMode: "total",
  };
  const session: Entry = {
    id: "workout", kind: "session", dirty: false, version: 2, updatedAt: "",
    data: {
      date: "2026-11-22", status: "completed", title: "Workout",
      exercises: [{
        machineId: "we", loadMode: "total", note: "", setup: "",
        sets: [
          { id: "first", load: null, loadText: "Mรวม25", reps: 12, done: true },
          { id: "second", load: null, reps: null, done: false },
        ],
      }],
    },
  };
  const moves = [{ from: "we", to: "m", machine, originalName: "Chest Press" }];
  const changes = planSessionMove([session], "workout", "M Fitness", moves);
  expect(changes.find((change) => change.id === "workout")?.data.exercises[0]).toMatchObject({
    machineId: "m",
    originalName: "Chest Press",
    sets: [
      { id: "first", load: 25, loadText: undefined, reps: 12, done: true },
      { id: "second", load: null, reps: null, done: false },
    ],
  });
  expect(session.data.exercises[0].sets[0].load).toBeNull();
  expect(() => planSessionMove([session], "workout", "Jett", moves)).toThrow();
});
