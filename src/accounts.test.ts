// @vitest-environment jsdom
import "./test-fresh-idb";
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

describe("switching accounts in one browser", () => {
  it("clears the previous account's copy when nothing is waiting to sync", async () => {
    const { adoptLocalAccount, allEntries, putEntry } = await import("./db");
    // Earlier tests leave unsynced items; pretend they reached the cloud.
    for (const e of await allEntries()) await putEntry({ ...e, dirty: false });
    localStorage.setItem("lilly-owner", "coach");
    localStorage.setItem("lilly-last-page", "x");
    await putEntry({ id: "c1", kind: "cardio", data: {}, updatedAt: "", version: 1, dirty: false });
    expect(await adoptLocalAccount("owner")).toBe(true);
    expect(await allEntries()).toEqual([]);
    expect(localStorage.getItem("lilly-owner")).toBe("owner");
    expect(localStorage.getItem("lilly-last-page")).toBeNull();
  });
  it("keeps the copy and refuses when changes would be lost", async () => {
    const { adoptLocalAccount, allEntries, putEntry } = await import("./db");
    localStorage.setItem("lilly-owner", "owner");
    await putEntry({ id: "c2", kind: "cardio", data: {}, updatedAt: "", version: 0, dirty: true });
    expect(await adoptLocalAccount("coach")).toBe(false);
    expect((await allEntries()).map((e) => e.id)).toContain("c2");
    expect(localStorage.getItem("lilly-owner")).toBe("owner");
  });
});
