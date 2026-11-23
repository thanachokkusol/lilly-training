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
import TrainingCalendar from "./TrainingCalendar";
import { save, allEntries } from "./db";
import { dateLabel, today, weekOf } from "./core";
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
  localStorage.clear();
});
it("shows both workout types on the actual date and opens the day's details", async () => {
  const date = today().slice(0, 7) + "-02";
  const emptyDate = today().slice(0, 7) + "-03";
  const metadata = { version: 1, updatedAt: date, dirty: false };
  render(<TrainingCalendar entries={[
    { ...metadata, id: "calendar-strength", kind: "session", data: {
      date, title: "Home workout", status: "completed", exercises: [
        { machineId: "calendar-exercise", originalName: "Hammer Curl", loadMode: "per-side",
          sets: [{ id: "calendar-set", load: 5, reps: 12, done: true }] },
      ],
    } },
    { ...metadata, id: "calendar-cardio", kind: "cardio", data: {
      date, week: "2000-01-02", activity: "ต่อยมวย", seconds: 3600, status: "confirmed",
    } },
    { ...metadata, id: "calendar-review", kind: "cardio", data: {
      date: emptyDate, activity: "เดิน", seconds: 400, status: "review",
    } },
  ]} />);
  fireEvent.click(screen.getByRole("button", { name: `${dateLabel(date)} · Strength และ Cardio` }));
  const dialog = await topDialog();
  expect(dialog.getByText("Hammer Curl")).toBeTruthy();
  expect(dialog.getByText(/ข้างละ 5.*12 ครั้ง/)).toBeTruthy();
  expect(dialog.getByText("ต่อยมวย")).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "ปิด" }));
  fireEvent.click(screen.getByRole("button", { name: `${dateLabel(emptyDate)} · ไม่มีบันทึก` }));
  expect((await topDialog()).getByText("ไม่มีบันทึกการฝึกวันนี้")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "ปิด" }));
  fireEvent.click(screen.getByRole("button", { name: "เดือนก่อน" }));
  expect(screen.queryByRole("button", { name: `${dateLabel(date)} · Strength และ Cardio` })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "เดือนนี้" }));
  expect(screen.getByRole("button", { name: `${dateLabel(date)} · Strength และ Cardio` })).toBeTruthy();
});
it.each([
  ["Goblet Squat", "home-goblet-squat", 2],
  ["Two-Hand Kettlebell Swing", "home-kb-swing", 2],
  ["Kettlebell Upright Row", "home-kb-upright-row", 1],
  ["Push-up", "home-push-up", 2],
  ["Forward Lunge", "home-forward-lunge", 2],
  ["Dumbbell Concentration Curl", "home-db-concentration-curl", 2],
  ["Dumbbell Reverse Curl", "home-db-reverse-curl", 2],
  ["Lying Dumbbell Triceps Extension", "home-db-lying-extension", 2],
] as const)("shows %s under the home filter with editable photos", async (name, id, frameCount) => {
  location.hash = "#machines";
  render(<App />);
  fireEvent.change(await screen.findByLabelText("ฟิตเนส"), { target: { value: "ที่บ้าน" } });
  expect(await screen.findByRole("heading", { name: "Chair Squat" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Goblet Squat" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Dead Bug" })).toBeTruthy();
  expect(screen.queryByText("โปรแกรมที่บ้าน · เวททั้งตัว")).toBeNull();
  const request = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    new Response(new Blob(["photo"], { type: "image/jpeg" })),
  );
  const objectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:test" });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
  try {
    fireEvent.click(screen.getByRole("heading", { name }));
    const dialog = await topDialog();
    expect(await dialog.findByRole("button", { name: "รูปหลัก" })).toBeTruthy();
    expect(dialog.queryAllByRole("button", { name: "เปิดรูปเครื่อง" })).toHaveLength(frameCount - 1);
    expect(dialog.getByLabelText("เลือกรูป")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "ลบรูปที่เปิด" }));
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันลบรูป" }));
    await waitFor(async () => {
      const photos = (await allEntries()).filter((entry) => entry.id.startsWith(`guide-photo-${id}-`));
      expect(photos).toHaveLength(frameCount);
      expect(photos.filter((entry) => entry.deleted)).toHaveLength(1);
    });
    cleanup();
  } finally {
    request.mockRestore();
    if (objectUrl) Object.defineProperty(URL, "createObjectURL", objectUrl);
    else Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  }
});
it("opens the adapted coach plan with the home gym and all six exercises selected", async () => {
  location.hash = "#today";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Coach Plan · Home/ }));
  const dialog = await topDialog();
  expect((dialog.getByLabelText("ยิมที่ฝึก") as HTMLSelectElement).value).toBe("ที่บ้าน");
  expect(dialog.getByText(/ดัดแปลงจากบันทึก WE Upper/)).toBeTruthy();
  expect((dialog.getByRole("button", { name: /เริ่มบันทึก 6 ท่า/ }) as HTMLButtonElement).disabled).toBe(false);
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
    dialog.getAllByRole("button", { name: /^(รูปหลัก|เปิดรูปเครื่อง)$/ }),
  ).toHaveLength(2);
  fireEvent.click(dialog.getByRole("button", { name: "เปิดรูปเครื่อง" }));
  fireEvent.click(dialog.getByRole("button", { name: "ใช้รูปที่เปิดเป็นรูปหลัก" }));
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
    dialog.getAllByRole("button", { name: /^(รูปหลัก|เปิดรูปเครื่อง)$/ }),
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
    dialog.getAllByRole("button", { name: /^(รูปหลัก|เปิดรูปเครื่อง)$/ }),
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
    (await screen.findAllByRole("button", { name: "Cardio" }))[0],
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
  const start = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(start);
  try {
    fireEvent.click(screen.getByRole("button", { name: "60วิ" }));
    clock.mockReturnValue(start + 73_000);
    fireEvent(window, new Event("pageshow"));
    expect(screen.getByText(/หมดเวลาพัก.*\+0:13/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ปิดตัวจับเวลา" }));
  } finally {
    clock.mockRestore();
  }
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
    stored?.data.exercises[0].sets.map((s: any) => [s.load, s.reps, s.done, s.enteredAs]),
  ).toEqual([
    [20, 12, true, "perSide"],
    [25, 10, true, "perSide"],
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
