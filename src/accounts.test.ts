import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { loginEmail } from "./cloud";
import { save, setReadOnly, trash } from "./db";

describe("trainer accounts", () => {
  it("maps a username to the internal sign-in address and keeps real emails", () => {
    expect(loginEmail(" CoachBank ")).toBe("coachbank@lilly.local");
    expect(loginEmail("Owner@Example.com")).toBe("owner@example.com");
  });
  it("blocks every local write while viewing a client's journal", async () => {
    await save("settings", { cardioGoal: 150, walkGoal: 150 }, "settings-main");
    setReadOnly("ดูอย่างเดียว");
    await expect(
      save("settings", { cardioGoal: 10, walkGoal: 10 }, "settings-main"),
    ).rejects.toThrow("ดูอย่างเดียว");
    await expect(trash("settings-main")).rejects.toThrow("ดูอย่างเดียว");
    setReadOnly("");
    await expect(
      save("settings", { cardioGoal: 120, walkGoal: 150 }, "settings-main"),
    ).resolves.toBeTruthy();
  });
});
