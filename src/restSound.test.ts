import { describe, expect, it } from "vitest";
import { restCue, restStage } from "./restSound";

const end = 100_000;
describe("rest timer cues", () => {
  it("ticks at 10 seconds left, twice at 0:00 and every 30 seconds after", () => {
    expect(restCue(end, end - 10_500, 0)).toBeNull();
    expect(restCue(end, end - 9_800, 0)).toBe("soon");
    expect(restCue(end, end - 5_000, 1)).toBeNull();
    expect(restCue(end, end + 200, 1)).toBe("end");
    expect(restCue(end, end + 29_000, 2)).toBeNull();
    expect(restCue(end, end + 30_300, 2)).toBe("over");
    expect(restCue(end, end + 60_300, 3)).toBe("over");
  });
  it("does not replay missed cues when the screen comes back late", () => {
    // Came back 2 minutes after the end: only the stage is remembered, nothing plays.
    expect(restStage(end, end + 125_000)).toBe(6);
    expect(restCue(end, end + 125_000, 1)).toBeNull();
    expect(restCue(end, end - 3_000, 0)).toBeNull();
  });
});
