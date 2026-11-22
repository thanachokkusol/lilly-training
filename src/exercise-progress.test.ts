import { expect, it } from "vitest";
import { exerciseProgress, machinePhotoIds } from "./core";
import type { Entry, Machine } from "./types";

it("keeps a Jett reference photo on Jett even if an old WE card linked it", () => {
  const base = { version: 1, dirty: false, updatedAt: "" };
  const reference = "photo-jett-ref-pullup";
  const jett: Machine = { name: "Assisted Pull-up", gym: "Jett", thai: "", group: "หลัง", setup: "", cues: "", loadMode: "assistance", photoId: reference };
  const we: Machine = { ...jett, gym: "WE Fitness", referencePhotoId: reference };
  const entries: Entry[] = [
    { ...base, id: "jett-pullup", kind: "machine", data: jett },
    { ...base, id: "we-pullup", kind: "machine", data: we },
    { ...base, id: reference, kind: "photo", data: { machineId: "we-pullup" } },
  ];
  expect(machinePhotoIds(entries, "we-pullup", we)).toEqual({ photos: [], main: undefined });
  expect(machinePhotoIds(entries, "jett-pullup", jett).main).toBe(reference);
});

it("continues the index when switching gyms and compares returning sets with the same machine", () => {
  const results = [["we", 25], ["we", 30], ["m", 25], ["m", 30], ["we", 33]] as const;
  const sessions = results.map(([machineId, load], i): Entry => ({
    id: String(i),
    kind: "session",
    version: 1,
    dirty: false,
    updatedAt: "",
    data: {
      date: `2026-11-0${i + 1}`,
      status: "completed",
      exercises: [{ machineId, loadMode: "total", sets: [{ done: true, load, reps: 12 }] }],
    },
  }));
  const points = exerciseProgress(sessions, ["we", "m"]);
  expect(points.map((point) => Number(point.percent.toFixed(2)))).toEqual([0, 20, 20, 44, 58.4]);
  expect(points.filter((point) => point.machineId === "m").map((point) => point.heaviest.kg)).toEqual([25, 30]);
});
