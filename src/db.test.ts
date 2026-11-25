import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  save,
  allEntries,
  trash,
  restoreEntry,
  inspectBackup,
  importBackup,
  exportBackup,
  storePhoto,
  photoBlob,
  getEntry,
  moveReviewedSession,
  mergeExerciseGroups,
} from "./db";
describe("durable records and backup", () => {
  it("merges exercise names without moving sets or photos between physical machines", async () => {
    const data = { thai: "", group: "หลัง", setup: "", cues: "", loadMode: "total" };
    const old = await save("machine", { ...data, name: "QA Seated Row", gym: "Jett", photoId: "merge-photo" }, "merge-old");
    const canonical = await save("machine", { ...data, name: "QA Seated Cable Row", gym: "M Fitness" }, "merge-canonical");
    const sets = [{ id: "merge-set", load: 20, reps: 10, done: true }];
    const session = await save("session", {
      date: "2026-11-10", title: "Merge fixture", status: "completed",
      exercises: [{ machineId: old.id, loadMode: "total", note: "", setup: "", sets }],
    }, "merge-session");
    await mergeExerciseGroups("qa seated row", "qa seated cable row");
    expect((await getEntry(old.id))?.data).toMatchObject({
      name: "QA Seated Cable Row", gym: "Jett", photoId: "merge-photo",
      aliases: ["QA Seated Row"], exerciseId: "qa seated cable row",
    });
    expect((await getEntry(canonical.id))?.data.exerciseId).toBe("qa seated cable row");
    expect((await getEntry(session.id))?.data.exercises[0]).toMatchObject({
      machineId: old.id, originalName: "QA Seated Row", sets,
    });
  });
  it("rejects a stale migration review and stores the machine and repointed session together", async () => {
    const data = {
      date: "2026-11-22", title: "Migration fixture", status: "completed",
      exercises: [{ machineId: "move-source", loadMode: "total", note: "", setup: "",
        sets: [{ id: "move-set", load: null, loadText: "Mรวม25", reps: 12, done: true }] }],
    };
    const first = await save("session", data, "move-session");
    const latest = await save("session", { ...data, note: "Updated after review" }, first.id);
    const moves = [{
      from: "move-source", to: "move-target",
      machine: { name: "Chest Press", thai: "", group: "อก", gym: "M Fitness",
        loadMode: "total" as const, setup: "", cues: "" },
    }];
    await expect(moveReviewedSession(first, "M Fitness", moves)).rejects.toThrow();
    expect(await getEntry("move-target")).toBeUndefined();
    await moveReviewedSession(latest, "M Fitness", moves);
    expect((await getEntry("move-target"))?.data.gym).toBe("M Fitness");
    expect((await getEntry(first.id))?.data).toMatchObject({
      gym: "M Fitness", note: latest.data.note,
      exercises: [{ machineId: "move-target", sets: [{ id: "move-set", load: 25, reps: 12 }] }],
    });
  });
  it("persists and recovers soft deleted logs", async () => {
    const e = await save(
      "body",
      { date: "2026-11-19", weight: 70, waist: null, fat: null, smm: null },
      "test-body",
    );
    await trash(e.id);
    expect((await allEntries()).find((x) => x.id === e.id)?.deleted).toBe(true);
    await restoreEntry(e.id);
    expect((await allEntries()).find((x) => x.id === e.id)?.deleted).toBe(
      false,
    );
  });
  it("restores a backup without counting the same source twice", async () => {
    const zip = new JSZip();
    zip.file(
      "backup.json",
      JSON.stringify({
        format: "lilly-training",
        schemaVersion: 1,
        entries: [
          {
            id: "test-import",
            kind: "body",
            data: {
              date: "2026-11-19",
              weight: 71,
              waist: null,
              fat: null,
              smm: null,
            },
            dirty: false,
            version: 30,
            updatedAt: "2026-11-19T12:00:00Z",
          },
        ],
      }),
    );
    const b = await zip.generateAsync({ type: "uint8array" });
    const file = b as unknown as Blob;
    expect((await importBackup(file)).added).toBe(1);
    expect((await importBackup(file)).skipped).toBe(1);
    const e = (await allEntries()).find((e) => e.id === "test-import");
    expect(e?.dirty).toBe(true);
    expect(e?.version).toBe(0);
  });
  it("rejects unrelated ZIPs and invalid durations before import", async () => {
    const z = new JSZip();
    z.file("hello.txt", "nothing");
    await expect(
      inspectBackup(
        (await z.generateAsync({ type: "uint8array" })) as unknown as Blob,
      ),
    ).rejects.toThrow("backup.json");
    z.file(
      "backup.json",
      JSON.stringify({
        format: "lilly-training",
        schemaVersion: 1,
        entries: [
          {
            id: "bad",
            kind: "cardio",
            data: { seconds: -1, date: "2026-11-19", week: "2026-11-15" },
          },
        ],
      }),
    );
    await expect(
      inspectBackup(
        (await z.generateAsync({ type: "uint8array" })) as unknown as Blob,
      ),
    ).rejects.toThrow("คาร์ดิโอ");
  });
  it("stores image bytes separately from record data", async () => {
    const b = new Blob(["photo"], { type: "image/jpeg" });
    await storePhoto("test-photo", b);
    expect(await (await photoBlob("test-photo"))?.text()).toBe("photo");
  });
});
it("stores new photos no larger than 720 pixels on the short side and never enlarges them", async () => {
  const { photoScale } = await import("./db");
  const size = (w: number, h: number) => [w, h].map((side) => Math.round(side * photoScale(w, h)));
  expect(size(4032, 3024)).toEqual([960, 720]);
  expect(size(1206, 2622)).toEqual([720, 1565]);
  expect(size(1080, 9000)).toEqual([360, 3000]);
  expect(size(640, 480)).toEqual([640, 480]);
});
