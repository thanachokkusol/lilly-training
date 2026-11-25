import { existsSync } from "node:fs";
import { it, expect } from "vitest";
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
