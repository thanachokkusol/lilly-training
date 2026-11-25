import { existsSync } from "node:fs";
import "./test-fresh-idb";
import { describe, expect, it } from "vitest";
import data from "./catalogData.json";
import { catalogLinks } from "./catalogLinks";
import { catalogMachineId, equipmentLabels, loadModeOf, machineFromCatalog, machinesOf, noGym, recordLabels, searchCatalog, type CatalogItem } from "./catalog";
import { formatSet } from "./core";
import { gymsFor, gymInUse } from "./gyms";
import { allEntries, removeGym, save } from "./db";
import { catalogIdOf, categoryOf, isMuscle } from "./muscles";
import { validateEntry } from "./validation";
import { machineRecords, sessionVolume, setRecords } from "./workoutStats";
import type { Entry, SetLog } from "./types";

const items = data as CatalogItem[];
const find = (en: string) => items.find((item) => item.en === en)!;
describe("universal exercises", () => {
  it("has every exercise except cardio and boxing, with unique ids and names and a full how-to", () => {
    expect(items).toHaveLength(430);
    expect(items.filter((item) => !item.archived)).toHaveLength(427);
    expect(items.filter((item) => item.images)).toHaveLength(18);
    expect(new Set(items.map((item) => item.id)).size).toBe(430);
    expect(new Set(items.map((item) => item.th)).size).toBe(430);
    expect(items.filter((item) => item.steps.length < 6)).toEqual([]);
    expect(items.filter((item) => ["Boxing", "Treadmill", "Running", "Cycling"].includes(item.en))).toEqual([]);
    expect(items.filter((item) => !isMuscle(item.primary) || !item.secondary.every(isMuscle) ||
      !(item.equipment in equipmentLabels) || !(item.record in recordLabels))).toEqual([]);
    expect(items.flatMap((item) => item.images ?? []).filter((file) => !existsSync(`public/catalog/${file}`))).toEqual([]);
  });
  it("turns every exercise into a valid machine of ours", () => {
    for (const item of items) {
      const machine = machineFromCatalog(item, noGym);
      expect(() => validateEntry({ id: catalogMachineId(item.id, noGym), kind: "machine", data: machine })).not.toThrow();
      expect([catalogIdOf(machine), categoryOf(machine)]).toEqual([item.id, item.primary]);
    }
    expect(loadModeOf(find("Bicep Curl (Dumbbell)"))).toBe("per-side");
    expect(loadModeOf(find("Concentration Curl"))).toBe("total");
    expect(loadModeOf(find("Pull Up (Assisted)"))).toBe("assistance");
    expect(machineFromCatalog(find("Plank"), noGym)).toMatchObject({ loadMode: "bodyweight", record: "time" });
  });
  it("links our own machines to real exercises without changing them", () => {
    for (const link of Object.values(catalogLinks)) {
      const item = items.find(({ id }) => id === link.id)!;
      expect([item.primary, item.secondary, item.archived]).toEqual([link.primary, link.secondary, undefined]);
    }
    expect(catalogIdOf({ name: "Chest Press", group: "อก" })).toBe(find("Chest Press (Machine)").id);
    expect(catalogIdOf({ name: "Chest Press", group: "อก", catalogId: "" })).toBeUndefined();
    expect(categoryOf({ name: "Wall Calf Stretch", group: "Stretch" })).toBe("stretch");
    expect(categoryOf({ name: "Chest Press", group: "อก", category: "triceps" })).toBe("triceps");
  });
  it("searches Thai and English and hides archived exercises", () => {
    expect(searchCatalog(items, "bench press barbell").length).toBeGreaterThan(3);
    expect(searchCatalog(items, find("Plank").th).map((item) => item.en)).toContain("Plank");
    expect(searchCatalog(items, "Box Squat").map((item) => item.en)).toEqual(["Box Squat (Barbell)"]);
    expect(searchCatalog(items, "", "neck")).toHaveLength(4);
  });
});
describe("recording by time, distance and added weight", () => {
  const set = (extra: Partial<SetLog>): SetLog => ({ id: "s", load: null, reps: 1, warmup: false, done: true, ...extra });
  const session = (id: string, record: any, loadMode: any, sets: SetLog[]): Entry => ({
    id, kind: "session", version: 1, dirty: false, updatedAt: "2026-11-01", data: { date: "2026-11-01", title: id, status: "completed", note: "",
      exercises: [{ machineId: "x", loadMode, record, setup: "", note: "", sets }] },
  });
  it("formats, validates and ranks them without inventing volume", () => {
    const plank = set({ holdSeconds: 75, timed: true }), carry = set({ load: 20, meters: 40 }), dip = set({ load: 5, reps: 8 });
    expect(formatSet(plank, "bodyweight")).toBe("1:15 นาที");
    expect(formatSet(carry, "total")).toBe("20 กก. × 40 ม.");
    expect(formatSet(dip, "bodyweight")).toBe("น้ำหนักตัว +5 กก. × 8 ครั้ง");
    expect(formatSet(set({ meters: 30, holdSeconds: 25, timed: true }), "bodyweight")).toBe("30 ม. × 25 วิ");
    expect(formatSet(set({ holdSeconds: 10, reps: 3 }), "bodyweight")).toBe("ค้าง 10 วิ × 3 ครั้ง");
    for (const entry of [session("a", "time", "bodyweight", [plank]), session("b", "distance", "total", [carry]), session("c", "added", "bodyweight", [dip])]) {
      expect(() => validateEntry(entry)).not.toThrow();
      expect(sessionVolume(entry.data)).toBe(0);
    }
    expect(setRecords([{ set: plank, mode: "bodyweight" }], set({ holdSeconds: 80, timed: true }), "bodyweight")).toEqual(["time"]);
    expect(setRecords([{ set: dip, mode: "bodyweight" }], set({ load: 7.5, reps: 5 }), "bodyweight")).toEqual(["added"]);
    const records = machineRecords([session("a", "time", "bodyweight", [plank])], "x");
    expect([records.time?.value, records.reps]).toEqual([75, undefined]);
  });
});
it("keeps exercises without a gym in one place that cannot be removed", async () => {
  expect(gymsFor([]).at(-1)).toMatchObject({ id: noGym });
  await save("machine", machineFromCatalog(find("Plank"), noGym), catalogMachineId(find("Plank").id, noGym));
  const entries = await allEntries();
  expect(machinesOf(entries, find("Plank").id)).toHaveLength(1);
  expect(gymsFor(entries).filter((gym) => gym.id === noGym)).toHaveLength(1);
  expect(gymInUse(entries, noGym)).toBe(true);
  await expect(removeGym(noGym)).rejects.toThrow();
});
