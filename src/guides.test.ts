import "./test-fresh-idb";
import { existsSync } from "node:fs";
import { it, expect, vi } from "vitest";
import { addBundledMachinePhotos, allEntries, getEntry, save } from "./db";
import { exerciseGuide, exerciseGuideFrames, homeMoves } from "./homeTraining";
import { stretchMoves } from "./stretchTraining";

it("bundles a picture for every home exercise and stretch", () => {
  const missing = [...homeMoves, ...stretchMoves].flatMap(({ name }) => {
    const guide = exerciseGuide(name);
    if (!guide) return [name];
    return exerciseGuideFrames(guide).filter((frame) => !existsSync(`public/exercise-guides/${guide}/${frame}.jpg`))
      .map((frame) => `${name} ${frame}`);
  });
  expect(missing).toEqual([]);
});

it("replaces a saved copy of the wrong stretch drawing with the new pictures", async () => {
  const id = "home-stretch-wall-straight";
  await save("photo", { machineId: id, label: "old", mime: "image/jpeg" }, `guide-photo-${id}-0`);
  await save("photo", { machineId: id, label: "mine", mime: "image/jpeg" }, "own-photo");
  const request = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(new Blob(["photo"])));
  try {
    await addBundledMachinePhotos(id, "Wall Chest Stretch (Straight Arm)", "Wall_Chest_Stretch_Straight");
  } finally {
    request.mockRestore();
  }
  expect((await getEntry(`guide-photo-${id}-0`))?.deleted).toBe(true);
  expect((await allEntries()).filter((entry) => !entry.deleted).map((entry) => entry.id).sort())
    .toEqual([`guide-photo-${id}-1`, `guide-photo-${id}-2`, "own-photo"]);
  // Opening an unchanged exercise never removes its first picture.
  await save("photo", { machineId: "home-crunch", label: "Crunch", mime: "image/jpeg" }, "guide-photo-home-crunch-0");
  await save("photo", { machineId: "home-crunch", label: "Crunch", mime: "image/jpeg" }, "guide-photo-home-crunch-1");
  await addBundledMachinePhotos("home-crunch", "Crunch", "Crunches");
  expect((await getEntry("guide-photo-home-crunch-0"))?.deleted).toBeFalsy();
});
