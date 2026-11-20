// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import App from "./App";
import { save, allEntries } from "./db";
import { today, weekOf } from "./core";
vi.stubGlobal("scrollTo", () => {});
// UI fixtures use their own fake IndexedDB, never this machine's cloud project.
vi.stubEnv("VITE_SUPABASE_URL", "");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
const topDialog = async () => {
  await screen.findAllByRole("dialog");
  return within(screen.getAllByRole("dialog").at(-1)!);
};
afterEach(() => {
  cleanup();
  location.hash = "";
});
it("keeps both seed and added photos when changing the main photo and recovers a previously hidden seed photo", async () => {
  const id = "we-photo-regression";
  const originalId = `photo-${id}`;
  const secondId = "photo-regression-added";
  await save(
    "photo",
    { label: "Original seed photo", mime: "image/jpeg" },
    originalId,
  );
  await save(
    "photo",
    { label: "Added photo", mime: "image/jpeg", machineId: id },
    secondId,
  );
  await save(
    "machine",
    {
      name: "Photo Retention Machine",
      thai: "",
      gym: "WE Fitness",
      group: "อก",
      setup: "เบาะระดับ 6",
      cues: "",
      loadMode: "total",
      photoId: originalId,
    },
    id,
  );
  location.hash = "machines";
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: /Photo Retention Machine/ }),
  );
  let dialog = await topDialog();
  expect(
    dialog.getAllByRole("button", { name: /^(รูปหลัก|ตั้งเป็นรูปหลัก)$/ }),
  ).toHaveLength(2);
  fireEvent.click(dialog.getByRole("button", { name: "ตั้งเป็นรูปหลัก" }));
  await waitFor(async () =>
    expect((await allEntries()).find((e) => e.id === id)?.data.photoId).toBe(
      secondId,
    ),
  );
  expect(
    (await allEntries()).find((e) => e.id === originalId)?.data.machineId,
  ).toBe(id);
  dialog = await topDialog();
  expect(
    dialog.getAllByRole("button", { name: /^(รูปหลัก|ตั้งเป็นรูปหลัก)$/ }),
  ).toHaveLength(2);
  expect(dialog.getAllByRole("button", { name: "รูปหลัก" })).toHaveLength(1);
  cleanup();
  // Simulate a seed photo hidden by a primary-photo change in an older release.
  await save(
    "photo",
    { label: "Original seed photo", mime: "image/jpeg" },
    originalId,
  );
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: /Photo Retention Machine/ }),
  );
  dialog = await topDialog();
  expect(
    dialog.getAllByRole("button", { name: /^(รูปหลัก|ตั้งเป็นรูปหลัก)$/ }),
  ).toHaveLength(2);
});
it("shows remaining time until the full 150-minute goal is reached", async () => {
  await save(
    "cardio",
    {
      date: today(),
      week: weekOf(today()),
      activity: "เดิน",
      seconds: 6031,
      distance: null,
      speed: null,
      incline: null,
      kcal: null,
      status: "confirmed",
      walkGoal: true,
      note: "",
    },
    "goal-units-regression",
  );
  render(<App />);
  fireEvent.click(
    (await screen.findAllByRole("button", { name: "คาร์ดิโอ" }))[0],
  );
  expect(await screen.findByText("เหลือ 49 นาที 29 วินาที")).toBeTruthy();
});
it("starts a session, logs two sets in the focused machine view, and reopens them", async () => {
  await save(
    "machine",
    {
      name: "Regression Machine",
      thai: "ทดสอบ",
      gym: "WE Fitness",
      group: "อก",
      setup: "เบาะ6",
      cues: "ดันช้า ๆ",
      loadMode: "per-side",
    },
    "regression-machine",
  );
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /เลือกเครื่องเอง/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "ชื่อครั้งฝึก" }), {
    target: { value: "Regression Session" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: /Regression Machine/ }));
  fireEvent.click(screen.getByRole("button", { name: "เริ่มบันทึก 1 ท่า" }));
  await screen.findByText(/เสร็จ 0\/1 ท่า/);
  fireEvent.click(
    (await topDialog()).getByRole("button", { name: "เปิด Regression Machine" }),
  );
  expect(await screen.findByText("ดันช้า ๆ")).toBeTruthy();
  fireEvent.change(screen.getByRole("spinbutton", { name: "เซต 1 น้ำหนัก" }), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "เซต 1 จำนวนครั้ง" }), {
    target: { value: "12" },
  });
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันเซต 1" }));
  fireEvent.click(screen.getByRole("button", { name: "เพิ่มเซต" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "เซต 2 น้ำหนัก" }), {
    target: { value: "12.5" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "เซต 2 จำนวนครั้ง" }), {
    target: { value: "10" },
  });
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันเซต 2" }));
  fireEvent.click(screen.getByRole("button", { name: "กลับรายการ" }));
  fireEvent.click(await screen.findByRole("button", { name: "จบการฝึก" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const stored = (await allEntries()).find(
    (e) => e.kind === "session" && e.data.title === "Regression Session",
  );
  expect(stored?.data.status).toBe("completed");
  expect(
    stored?.data.exercises[0].sets.map((s: any) => [s.load, s.reps, s.done]),
  ).toEqual([
    [10, 12, true],
    [12.5, 10, true],
  ]);
  fireEvent.click(screen.getByRole("button", { name: /Regression Session/ }));
  await screen.findByText(/เสร็จ 1\/1 ท่า/);
  fireEvent.click(
    (await topDialog()).getByRole("button", { name: "เปิด Regression Machine" }),
  );
  expect(
    await screen.findByRole("spinbutton", { name: "เซต 2 น้ำหนัก" }),
  ).toHaveProperty("value", "12.5");
  fireEvent.click(screen.getByRole("button", { name: "ปิด" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await allEntries()).find((e) => e.id === stored?.id)?.updatedAt).toBe(
    stored?.updatedAt,
  );
}, 20000);
it("opens set entry within two taps from a machine and joins today's draft", async () => {
  await save(
    "machine",
    {
      name: "Two Tap Machine",
      thai: "",
      gym: "WE Fitness",
      group: "ขา",
      setup: "ระดับ 1",
      cues: "",
      loadMode: "total",
    },
    "two-tap",
  );
  location.hash = "machines";
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: /Two Tap Machine/ }),
  );
  fireEvent.click(
    (await topDialog()).getByRole("button", {
      name: /เริ่มฝึกท่านี้|เพิ่มเข้าการฝึกวันนี้|บันทึกเซตวันนี้/,
    }),
  );
  expect(
    await screen.findByRole("spinbutton", { name: "เซต 1 น้ำหนัก" }),
  ).toBeTruthy();
  const drafts = (await allEntries()).filter(
    (e) => e.kind === "session" && e.data.status === "draft",
  );
  expect(drafts.length).toBeGreaterThan(0);
}, 20000);
