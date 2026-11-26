// @vitest-environment jsdom
import "./test-fresh-idb";
import { it, expect, vi, afterEach } from "vitest";
import { openDB } from "idb";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
  configure,
} from "@testing-library/react";
import App, { Data, SessionEditor } from "./App";
import TrainingCalendar from "./TrainingCalendar";
import { save, allEntries } from "./db";
import { dateLabel, today, weekOf } from "./core";
vi.stubGlobal("scrollTo", () => {});
// The full suite runs files in parallel; on this machine a render can take just over the 1s default.
configure({ asyncUtilTimeout: 5000 });
// UI fixtures use their own fake IndexedDB, never this machine's cloud project.
vi.stubEnv("VITE_SUPABASE_URL", "");
vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
const topDialog = async () => {
  await screen.findAllByRole("dialog");
  return within(screen.getAllByRole("dialog").at(-1)!);
};
afterEach(async () => {
  cleanup();
  location.hash = "";
  localStorage.clear();
  // Every test starts with an empty journal, so a failure cannot leave a draft behind for the next one.
  const db = await openDB("lilly-training-v1");
  await Promise.all([db.clear("entries"), db.clear("photos")]);
  db.close();
});
it("starts a stretch from a normal Strength tile under the home location", async () => {
  location.hash = "#machines";
  render(<App />);
  const locationFilter = await screen.findByLabelText("ฟิตเนส");
  fireEvent.change(locationFilter, { target: { value: "WE Fitness" } });
  expect(screen.queryByRole("button", { name: /Wall Chest Stretch \(Elbow\)/ })).toBeNull();
  fireEvent.change(locationFilter, { target: { value: "ที่บ้าน" } });
  const stretch = await screen.findByRole("button", { name: /Wall Chest Stretch \(Elbow\)/ });
  expect(stretch.classList.contains("machine-tile")).toBe(true);
  expect(stretch.textContent).toContain("ที่บ้าน");
  fireEvent.click(stretch);
  const details = await topDialog();
  expect(details.getByLabelText("เลือกรูป")).toBeTruthy();
  fireEvent.click(details.getByRole("button", { name: /เริ่มฝึกท่านี้|เพิ่มเข้าการฝึกวันนี้/ }));
  const start = await screen.findByRole("button", { name: "เริ่มจับเวลาท่านี้" });
  fireEvent.click(start);
  const timer = await topDialog();
  expect(timer.getByText(/ขวา · ครั้ง 1\/3/)).toBeTruthy();
  fireEvent.click(timer.getByRole("button", { name: "ข้ามช่วง" }));
  expect(timer.getByRole("heading", { name: /พัก ·/ })).toBeTruthy();
  expect(timer.getByRole("button", { name: "บันทึกผลที่ทำแล้ว" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(timer.getByRole("button", { name: "ข้ามช่วง" }));
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 10_100);
  try {
    await timer.findByText(/ทำแล้ว 1 ครั้ง/);
    fireEvent.click(timer.getByRole("button", { name: "บันทึกผลที่ทำแล้ว" }));
    const workout = await topDialog();
    expect(workout.getByText("ค้าง 10 วิ × 1 ครั้ง")).toBeTruthy();
    fireEvent.click(workout.getByRole("button", { name: "จบการฝึก" }));
    await waitFor(async () => {
      const session = (await allEntries()).find((entry) => entry.kind === "session" && entry.data.title === "Wall Chest Stretch (Elbow)");
      expect(session?.data.status).toBe("completed");
      expect(session?.data.exercises[0].sets[0]).toMatchObject({ reps: 1, holdSeconds: 10, load: null });
    });
  } finally {
    clock.mockRestore();
  }
});
it("selects the three chest stretches, Cobra and Child's Pose from the Chest Stretch program", async () => {
  location.hash = "#today";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Chest Stretch ·? ?5 ท่า/ }));
  const plan = await topDialog();
  expect((plan.getByLabelText("ยิมที่ฝึก") as HTMLSelectElement).value).toBe("ที่บ้าน");
  expect(plan.getByRole("button", { name: /เริ่มบันทึก 5 ท่า/ })).toBeTruthy();
  expect(plan.queryAllByRole("alert")).toEqual([]);
});
it("adds Cobra and Child's Pose to a Chest Stretch program saved with the first three moves", async () => {
  await save("routine", { title: "Chest Stretch", days: [], note: "เดิม",
    machineIds: ["home-stretch-wall-elbow", "home-stretch-wall-straight", "home-stretch-doorway"] }, "routine-home-chest-stretch");
  location.hash = "#today";
  render(<App />);
  await waitFor(async () => expect((await allEntries()).find((e) => e.id === "routine-home-chest-stretch")!.data.machineIds)
    .toEqual(["home-stretch-wall-elbow", "home-stretch-wall-straight", "home-stretch-doorway", "home-stretch-cobra", "home-stretch-child"]));
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
it("starts today's home program with planned sets, guide photos and the cool-down timer", async () => {
  location.hash = "#today";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Home · ขา \+ แกนกลาง \+ อก/ }));
  const plan = await topDialog();
  expect((plan.getByLabelText("ยิมที่ฝึก") as HTMLSelectElement).value).toBe("ที่บ้าน");
  expect(plan.getByText(/ดันดัมเบลบนพื้น · 3 เซต × 10 ครั้ง/)).toBeTruthy();
  fireEvent.click(plan.getByRole("button", { name: /เริ่มบันทึก 14 ท่า/ }));
  await screen.findByText(/เสร็จ 0\/14 ท่า/);
  const session = async () => (await allEntries()).find((entry) => entry.kind === "session")!;
  const planned = (await session()).data.exercises;
  expect(planned.map((x: any) => x.sets.length)).toEqual([3, 3, 2, 2, 3, 3, 2, 0, 0, 0, 0, 0, 0, 0]);
  // Planned values are neither weights nor finished sets.
  expect(planned.flatMap((x: any) => x.sets).every((set: any) => set.load === null && !set.done)).toBe(true);
  expect(screen.getByRole("button", { name: /เปิดตัวจับเวลา Stretch · 7 ท่า/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "เปิด Crunch" }));
  const focus = await topDialog();
  expect(focus.getByText("เป้าวันนี้ 3 เซต × 12 ครั้ง")).toBeTruthy();
  // Both illustration frames, one at a time, each marked as an illustration.
  expect(focus.getByAltText("Crunch · ภาพประกอบ")).toBeTruthy();
  expect(focus.getByText("1 / 2 · ภาพประกอบ")).toBeTruthy();
  fireEvent.click(focus.getByRole("button", { name: "รูปถัดไป" }));
  expect(focus.getByText("2 / 2 · ภาพประกอบ")).toBeTruthy();
  fireEvent.click(focus.getByRole("button", { name: "ยืนยันเซต 1" }));
  fireEvent.click(focus.getByRole("button", { name: /รายการวันนี้/ }));
  expect(await screen.findByText(/เป้า 3 เซต × 12 ครั้ง · เสร็จ 1\/3/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /เปิดตัวจับเวลา Stretch/ }));
  fireEvent.click(await screen.findByRole("button", { name: "เริ่มจับเวลาทั้งชุด" }));
  const timer = await topDialog();
  expect(timer.getByRole("heading", { name: /ยืด · 20 วิ/ })).toBeTruthy();
  expect(timer.getByText(/ยืดหน้าสะโพก คุกเข่า · ขวา · ครั้ง 1\/2/)).toBeTruthy();
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 20_100);
  try {
    await timer.findByText(/ยืดหน้าสะโพก คุกเข่า · ทำแล้ว 1 ครั้ง/);
    fireEvent.click(timer.getByRole("button", { name: "บันทึกผลที่ทำแล้ว" }));
  } finally {
    clock.mockRestore();
  }
  fireEvent.click(await screen.findByRole("button", { name: "จบการฝึก" }));
  await waitFor(async () => expect((await session()).data.status).toBe("completed"));
  const done = (await session()).data.exercises.flatMap((x: any) => x.sets.filter((set: any) => set.done).map((set: any) => [x.machineId, set.reps, set.holdSeconds]));
  expect(done).toEqual([["home-crunch", 12, undefined], ["home-stretch-hip-flexor", 1, 20]]);
});
it("explains a stretch before starting, lets the person set it, press each repetition or log it without a timer", async () => {
  location.hash = "#machines";
  render(<App />);
  fireEvent.change(await screen.findByLabelText("ฟิตเนส"), { target: { value: "ที่บ้าน" } });
  fireEvent.click(await screen.findByRole("button", { name: /Wall Chest Stretch \(Elbow\)/ }));
  expect((await topDialog()).getByText("ค้าง 10 วิ × 3 ครั้งต่อข้าง")).toBeTruthy();
  fireEvent.click((await topDialog()).getByRole("button", { name: /เริ่มฝึกท่านี้/ }));
  await screen.findByRole("button", { name: "เริ่มจับเวลาท่านี้" });
  // Nothing runs until the person chooses.
  expect((await topDialog()).getByText(/งอศอกประมาณ 90°/)).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /เพิ่ม ยืดอก ศอกพิงกำแพง ค้างกี่วินาที/ }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "ยืดอก ศอกพิงกำแพง กี่ครั้งต่อข้าง" }), { target: { value: "2" } });
  expect(screen.getByText(/ค้าง 15 วิ × 2 ครั้งต่อข้าง/)).toBeTruthy();
  fireEvent.change(screen.getByRole("spinbutton", { name: "ยืดอก ศอกพิงกำแพง ทำไปทั้งหมดกี่ครั้ง" }), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "บันทึกค้าง 15 วิ × 3 ครั้ง" }));
  expect(await screen.findByText("ค้าง 15 วิ × 3 ครั้ง")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "ลบ ค้าง 15 วิ × 3 ครั้ง" }));
  expect(screen.queryByText("ค้าง 15 วิ × 3 ครั้ง")).toBeNull();
  // Step by step: the hold waits for a press and the next one does not start by itself.
  fireEvent.click(screen.getByRole("button", { name: "กดเองทีละครั้ง" }));
  expect(screen.getByRole("heading", { name: "พร้อมแล้วกดเริ่ม · 15 วิ" })).toBeTruthy();
  expect(screen.getByText(/ขวา · ครั้ง 1\/2/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "เริ่มค้าง" }));
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 15_100);
  try {
    expect(await screen.findByText(/ขวา · ครั้ง 2\/2/)).toBeTruthy();
  } finally {
    clock.mockRestore();
  }
  expect(screen.getByRole("heading", { name: "พร้อมแล้วกดเริ่ม · 15 วิ" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "นับว่าทำแล้ว" }));
  fireEvent.click(screen.getByRole("button", { name: "ข้ามครั้งนี้" }));
  expect(screen.getByText(/ซ้าย · ครั้ง 2\/2/)).toBeTruthy();
  expect(screen.getByText(/ทำแล้ว 2 ครั้ง/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "บันทึกผลที่ทำแล้ว" }));
  fireEvent.click(await screen.findByRole("button", { name: "จบการฝึก" }));
  await waitFor(async () => {
    const session = (await allEntries()).find((entry) => entry.kind === "session")!;
    expect(session.data.status).toBe("completed");
    expect(session.data.exercises[0].sets.map((set: any) => [set.reps, set.holdSeconds])).toEqual([[2, 15]]);
  });
});
it("adds how-to to a machine we already have without touching its name, notes, photo or records", async () => {
  const machine = { name: "Chest Press", thai: "เครื่องดันอก", gym: "WE Fitness", group: "อก", setup: "เบาะระดับ 6", cues: "ดันช้า ๆ", loadMode: "per-side", photoId: "photo-own" };
  await save("photo", { label: "own", mime: "image/jpeg", machineId: "we-chest" }, "photo-own");
  await save("machine", machine, "we-chest");
  await save("session", { date: "2026-01-10", title: "Old", status: "completed", note: "", exercises: [
    { machineId: "we-chest", loadMode: "per-side", setup: "", note: "", sets: [{ id: "a", load: 25, enteredAs: "perSide", reps: 12, warmup: false, done: true }] }] }, "old");
  location.hash = "#machines";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Chest Press/ }));
  const dialog = await topDialog();
  expect(await dialog.findByText(/^วิธีทำละเอียด/)).toBeTruthy();
  expect(dialog.getByText("ดันช้า ๆ")).toBeTruthy();
  expect(dialog.getByText("เบาะระดับ 6")).toBeTruthy();
  expect(dialog.getAllByText(/25 กก\. \(ข้างละ 12\.5\) × 12 ครั้ง/).length).toBeGreaterThan(0);
  // Saving the form unchanged keeps the record as it was.
  fireEvent.click(dialog.getByRole("button", { name: "แก้ไขรายละเอียด" }));
  const form = await topDialog();
  expect((await form.findByLabelText(/ท่าในคลังสากล/) as HTMLInputElement).value).toContain("Chest Press (Machine)");
  fireEvent.click(form.getByRole("button", { name: "บันทึกเครื่อง" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "แก้ไขเครื่อง" })).toBeNull());
  const stored = JSON.parse(JSON.stringify((await allEntries()).find((e) => e.id === "we-chest")!.data));
  expect(stored).toEqual({ ...machine, label: "", exerciseId: "chest press" });
}, 20000);
it("adds a library exercise once without a gym and records it by time", async () => {
  location.hash = "#machines";
  render(<App />);
  const locationFilter = await screen.findByLabelText("ฟิตเนส") as HTMLSelectElement;
  expect(locationFilter.value).toBe("WE Fitness");
  expect(screen.queryByRole("group", { name: "แสดง" })).toBeNull();
  fireEvent.change(locationFilter, { target: { value: "ไม่ระบุยิม" } });
  expect(await screen.findByRole("button", { name: /แสดงเพิ่ม/ })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("ค้นหาเครื่อง"), { target: { value: "side plank" } });
  const open = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /Side Plank/ }));
    return topDialog();
  };
  let dialog = await open();
  expect(dialog.getAllByRole("listitem").length).toBeGreaterThanOrEqual(6);
  fireEvent.click(dialog.getByRole("button", { name: "เพิ่มท่านี้" }));
  await screen.findByRole("button", { name: /เริ่มฝึกท่านี้/ });
  fireEvent.click((await topDialog()).getByRole("button", { name: "ปิด" }));
  expect(screen.getAllByRole("heading", { name: /^Side Plank(?: ·|$)/ })).toHaveLength(1);
  dialog = await open();
  expect(dialog.getByRole("button", { name: /เริ่มฝึกท่านี้/ })).toBeTruthy();
  const machines = (await allEntries()).filter((e) => e.kind === "machine" && e.data.catalogId && !e.deleted);
  expect(machines.map((e) => [e.data.name, e.data.gym, e.data.record, e.data.category])).toEqual([["Side Plank", "ไม่ระบุยิม", "time", "abdominals"]]);
  fireEvent.click((await topDialog()).getByRole("button", { name: /เริ่มฝึกท่านี้/ }));
  const seconds = await screen.findByRole("spinbutton", { name: "เซต 1 เวลา (วินาที)" });
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันเซต 1" }));
  expect(await screen.findByText("กรอกเวลาหรือระยะให้ครบก่อนยืนยัน")).toBeTruthy();
  fireEvent.change(seconds, { target: { value: "45" } });
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันเซต 1" }));
  fireEvent.click(screen.getByRole("button", { name: "กลับรายการ" }));
  fireEvent.click(await screen.findByRole("button", { name: "จบการฝึก" }));
  await waitFor(async () => {
    const session = (await allEntries()).find((e) => e.kind === "session")!.data;
    expect([session.status, session.gym]).toEqual(["completed", "ไม่ระบุยิม"]);
    expect(session.exercises[0]).toMatchObject({ record: "time", loadMode: "bodyweight", sets: [{ holdSeconds: 45, timed: true, reps: 1, done: true }] });
  });
}, 20000);
it("keeps unidentified Jett entries and their photos in Settings until the owner links a move", async () => {
  const pendingIds = [2, 3, 7, 15, 18];
  for (const page of pendingIds) {
    const id = `jett-extra-${page}`;
    const photoId = `photo-${id}`;
    await save("photo", { machineId: id, mime: "image/jpeg", label: "" }, photoId);
    await save("machine", {
      name: `เครื่อง Jett หน้า ${page} · รอยืนยันชื่อ`, thai: "", gym: "Jett", group: "อื่น ๆ",
      setup: "", cues: "", loadMode: "total", photoId,
    }, id);
  }
  const before = (await allEntries()).filter((entry) => entry.id.includes("jett-extra-"));
  location.hash = "#machines";
  render(<App />);
  fireEvent.change(await screen.findByLabelText("ฟิตเนส"), { target: { value: "Jett" } });
  expect(screen.queryByRole("button", { name: /รอยืนยันชื่อ/ })).toBeNull();
  fireEvent.click(screen.getAllByRole("button", { name: "Settings" })[0]);
  expect(await screen.findByRole("heading", { name: "เครื่อง Jett ที่รอตอบ" })).toBeTruthy();
  expect(screen.getAllByRole("heading", { name: /รอยืนยันชื่อ/ })).toHaveLength(5);
  expect((await allEntries()).filter((entry) => entry.id.includes("jett-extra-"))).toEqual(before);
  fireEvent.click(screen.getAllByRole("button", { name: "เลือกท่าจากรายการ" })[0]);
  const answer = screen.getByLabelText(/เลือกท่าสำหรับ เครื่อง Jett หน้า 2/);
  const option = await within(answer).findByRole("option", { name: /^Chest Press \(Machine\)/ }) as HTMLOptionElement;
  fireEvent.change(answer, { target: { value: option.value } });
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันคำตอบ" }));
  await waitFor(() => expect(screen.getAllByRole("heading", { name: /รอยืนยันชื่อ/ })).toHaveLength(4));
  const after = await allEntries();
  expect(after.find((entry) => entry.id === "jett-extra-2")?.data).toEqual({
    ...before.find((entry) => entry.id === "jett-extra-2")!.data, catalogId: option.value,
  });
  expect(after.find((entry) => entry.id === "photo-jett-extra-2")).toEqual(before.find((entry) => entry.id === "photo-jett-extra-2"));
  fireEvent.click(screen.getAllByRole("button", { name: "Strength" })[0]);
  expect((await screen.findByLabelText("ฟิตเนส") as HTMLSelectElement).value).toBe("Jett");
  expect(await screen.findAllByRole("button", { name: /เครื่อง Jett หน้า 2 · รอยืนยันชื่อ/ })).toHaveLength(1);
});
it("uses the original machine card for a matching catalog move in all locations", async () => {
  const machine = { name: "Chest Press", thai: "", gym: "WE Fitness", group: "อก", setup: "เบาะระดับ 6",
    cues: "", loadMode: "total", aliases: ["ดันอกที่ WE"] };
  await save("machine", machine, "we-chest");
  location.hash = "#machines";
  render(<App />);
  const gym = await screen.findByLabelText("ฟิตเนส");
  fireEvent.change(gym, { target: { value: "ไม่ระบุยิม" } });
  expect(await screen.findByRole("button", { name: /แสดงเพิ่ม/ })).toBeTruthy();
  const search = screen.getByLabelText("ค้นหาเครื่อง");
  fireEvent.change(search, { target: { value: "Chest Press (Machine)" } });
  expect(screen.queryByText("Chest Press (Machine)")).toBeNull();
  fireEvent.change(gym, { target: { value: "" } });
  expect(await screen.findAllByRole("heading", { name: "Chest Press" })).toHaveLength(1);
  expect(screen.queryByText("Chest Press (Machine)")).toBeNull();
  fireEvent.change(search, { target: { value: "ดันอกที่ WE" } });
  fireEvent.change(screen.getByLabelText("อุปกรณ์"), { target: { value: "machine" } });
  fireEvent.click(screen.getByRole("heading", { name: "Chest Press" }));
  expect((await topDialog()).getByText("เบาะระดับ 6")).toBeTruthy();
});
it("shows the identified Jett machine once, with its own photo and gym-name buttons only", async () => {
  const data = { name: "เครื่อง Jett หน้า 3 · รอยืนยันชื่อ", thai: "", gym: "Jett",
    group: "อื่น ๆ", setup: "", cues: "", loadMode: "total", photoId: "photo-jett-extra-3" };
  await save("machine", data, "jett-extra-3");
  const other = { ...data, name: "Abdominal Crunch", photoId: "photo-legacy-crunch" };
  await save("machine", other, "jett-crunch");
  await save("machine", { ...other, gym: "WE Fitness" }, "we-crunch");
  await save("photo", { label: "", mime: "image/jpeg", machineId: "jett-extra-3" }, data.photoId);
  await save("photo", { label: "", mime: "image/jpeg", machineId: "jett-crunch" }, other.photoId);
  await save("photo", { label: "ภาพประกอบ", mime: "image/jpeg", machineId: "jett-extra-3" }, "guide-photo-jett-extra-3-0");
  location.hash = "#settings";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "ใช้ชื่อที่ระบุสำหรับเครื่อง Jett" }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "เครื่อง Jett ที่รอตอบ" })).toBeNull());
  expect((await allEntries()).find((entry) => entry.id === "jett-extra-3")?.data)
    .toEqual({ ...data, name: "Abdominal Crunch", catalogId: "EB43ADD4", exerciseId: "jett-extra-3" });
  fireEvent.click(screen.getAllByRole("button", { name: "Strength" })[0]);
  fireEvent.change(await screen.findByLabelText("ฟิตเนส"), { target: { value: "Jett" } });
  expect(screen.getAllByRole("heading", { name: "Abdominal Crunch" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("heading", { name: "Abdominal Crunch" }));
  const detail = await topDialog();
  const places = within(detail.getByLabelText("เลือกเครื่อง"));
  // Buttons name the gym only, in the usual order, and never repeat the exercise name.
  expect(places.getAllByRole("button").map((b) => b.textContent)).toEqual(["WE Fitness", "Jett", "เพิ่มเครื่องของท่านี้"]);
  expect(detail.getAllByRole("button", { name: "รูปหลัก" })).toHaveLength(1);
  expect(detail.queryByRole("button", { name: "เปิดรูปเครื่อง" })).toBeNull();
  // Its own photo comes first; the illustration follows, marked as such; the legacy Jett photo is not repeated.
  expect(detail.getByText(/^1 \/ \d · Jett$/)).toBeTruthy();
  expect(detail.queryAllByRole("button", { name: /^เปิดรูป ภาพประกอบ$/ }).length).toBeGreaterThan(0);
  expect(detail.queryAllByRole("button", { name: /^เปิดรูป (WE Fitness|Jett)$/ })).toEqual([]);
  expect((await allEntries()).find((entry) => entry.id === "jett-crunch")?.data).toEqual(other);
});
it("shows every gym's photos of an exercise in one row, labelled by gym, each picture once", async () => {
  const press = { name: "Hip Thrust Machine", thai: "", group: "ก้น", setup: "", cues: "", loadMode: "total" };
  await save("machine", { ...press, gym: "M Fitness", photoId: "p-m" }, "hip-m");
  await save("machine", { ...press, gym: "WE Fitness", photoId: "p-we" }, "hip-we");
  await save("photo", { label: "", mime: "image/jpeg", machineId: "hip-m" }, "p-m");
  await save("photo", { label: "", mime: "image/jpeg", machineId: "hip-we" }, "p-we");
  location.hash = "machines";
  render(<App />);
  fireEvent.click((await screen.findAllByRole("button", { name: /Hip Thrust Machine/ }))[0]);
  const detail = await topDialog();
  const places = within(detail.getByLabelText("เลือกเครื่อง"));
  expect(places.getAllByRole("button").map((b) => b.textContent)).toEqual(["WE Fitness", "M Fitness", "เพิ่มเครื่องของท่านี้"]);
  const counter = detail.getByText(/^1 \/ 2 · /).textContent!;
  const first = counter.endsWith("WE Fitness") ? "WE Fitness" : "M Fitness";
  fireEvent.click(detail.getByRole("button", { name: "รูปถัดไป" }));
  expect(detail.getByText(`2 / 2 · ${first === "WE Fitness" ? "M Fitness" : "WE Fitness"}`)).toBeTruthy();
});
it("removes an unused gym from every list but never one with history", async () => {
  const machine = { name: "Old Press", thai: "", group: "อก", setup: "", cues: "", loadMode: "total" };
  await save("machine", { ...machine, gym: "อื่น ๆ", archived: true }, "old-other");
  await save("machine", { ...machine, name: "WE Press", gym: "WE Fitness" }, "we-press");
  location.hash = "#settings";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /^WE Fitness/ }));
  expect((await topDialog()).queryByRole("button", { name: "ลบยิมนี้" })).toBeNull();
  fireEvent.click((await topDialog()).getByRole("button", { name: "ปิด" }));
  fireEvent.click(screen.getByRole("button", { name: /^อื่น ๆ/ }));
  fireEvent.click((await topDialog()).getByRole("button", { name: "ลบยิมนี้" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /^อื่น ๆ/ })).toBeNull());
  const entries = await allEntries();
  expect(entries.find((e) => e.id === "old-other")?.deleted).toBe(true);
  expect(entries.find((e) => e.id === "we-press")?.deleted).toBeFalsy();
  // Editing another gym keeps it removed.
  fireEvent.click(screen.getByRole("button", { name: /^Jett/ }));
  fireEvent.click((await topDialog()).getByRole("button", { name: "บันทึกยิม" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByRole("button", { name: /^อื่น ๆ/ })).toBeNull();
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
  fireEvent.change(screen.getByLabelText("ยิมที่ฝึก"), { target: { value: "WE Fitness" } });
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
  fireEvent.click(await screen.findByRole("button", { name: "เสร็จ" }));
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
it("keeps a finished workout completed when the dialog is closed while it is saving", async () => {
  await save("machine", {
    name: "Race Machine", thai: "", gym: "WE Fitness", group: "ขา", setup: "", cues: "", loadMode: "total",
  }, "race-machine");
  location.hash = "machines";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Race Machine/ }));
  fireEvent.click((await topDialog()).getByRole("button", { name: /เริ่มฝึกท่านี้/ }));
  fireEvent.change(await screen.findByRole("spinbutton", { name: "เซต 1 น้ำหนัก" }), { target: { value: "20" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "เซต 1 จำนวนครั้ง" }), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันเซต 1" }));
  fireEvent.click(screen.getByRole("button", { name: "กลับรายการ" }));
  fireEvent.click(await screen.findByRole("button", { name: "จบการฝึก" }));
  fireEvent.click((await topDialog()).getByRole("button", { name: "ปิด" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "จบการฝึก" })).toBeNull());
  await new Promise((resolve) => setTimeout(resolve, 800));
  const session = (await allEntries()).find((entry) => entry.kind === "session");
  expect(session?.data.status).toBe("completed");
});
it("attaches a pasted image to the cardio log as evidence", async () => {
  vi.stubGlobal("createImageBitmap", async () => ({ width: 10, height: 10, close() {} }));
  const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage() {} } as any);
  const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((done) => done(new Blob(["photo"], { type: "image/jpeg" })));
  const objectUrl = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:test" });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
  const paste = (file: File) => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { files: [file] } });
    fireEvent(document.body, event);
  };
  const photos = async () => (await allEntries()).filter((entry) => entry.kind === "photo");
  try {
    location.hash = "#cardio";
    render(<App />);
    const add = (await screen.findAllByRole("button", { name: "บันทึกคาร์ดิโอ" }))[0];
    paste(new File(["x"], "screen.png", { type: "image/png" }));
    expect(await photos()).toHaveLength(0);
    fireEvent.click(add);
    await topDialog();
    paste(new File(["x"], "notes.txt", { type: "text/plain" }));
    paste(new File(["x"], "screen.png", { type: "image/png" }));
    await waitFor(async () => expect(await photos()).toHaveLength(1));
    expect(await screen.findByAltText("หลักฐานคาร์ดิโอ")).toBeTruthy();
  } finally {
    context.mockRestore();
    toBlob.mockRestore();
    vi.stubGlobal("createImageBitmap", undefined);
    if (objectUrl) Object.defineProperty(URL, "createObjectURL", objectUrl);
    else Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
    cleanup();
  }
});
it("logs every exercise on one screen with last time as the hint, rests by itself and reports a record", async () => {
  const press = { name: "Chest Press", thai: "", gym: "WE Fitness", group: "อก", setup: "", cues: "", loadMode: "total" };
  await save("machine", press, "press");
  await save("machine", { ...press, name: "Seated Cable Row", group: "หลัง" }, "row");
  await save("session", {
    date: "2026-01-10", title: "Old", status: "completed", note: "", gym: "WE Fitness", exercises: [
      { machineId: "press", loadMode: "total", setup: "", note: "", sets: [
        { id: "a", load: 20, reps: 12, warmup: false, done: true },
        { id: "b", load: 22.5, reps: 10, warmup: false, done: true }] }],
  }, "old");
  await save("routine", { title: "Push Pull", machineIds: ["press", "row"], days: [], folder: "WE",
    targets: { press: { sets: 2, reps: 12, rest: 45 } } }, "routine-test");
  location.hash = "#today";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Push Pull.*WE · 2 ท่า/ }));
  fireEvent.click(await screen.findByRole("button", { name: "เริ่มบันทึก 2 ท่า" }));
  await screen.findByText(/เสร็จ 0\/2 ท่า/);
  // Last time fills the row and stays as the faint hint; there is no separate column for it.
  const firstLoad = screen.getByRole("spinbutton", { name: "Chest Press เซต 1 น้ำหนัก" });
  expect(firstLoad).toHaveProperty("value", "20");
  expect(firstLoad.getAttribute("placeholder")).toBe("20");
  expect(screen.queryByText("ครั้งก่อน", { selector: ".set-head span" })).toBeNull();
  expect(screen.queryByRole("button", { name: /ใช้ค่าครั้งก่อน/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันChest Press เซต 1" }));
  expect(await screen.findByText(/^พัก 0:4[45]$/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "เพิ่ม 15 วิ" }));
  expect(screen.getByText(/^พัก (1:00|0:59)$/)).toBeTruthy();
  fireEvent.change(screen.getByRole("spinbutton", { name: "Chest Press เซต 2 น้ำหนัก" }), { target: { value: "25" } });
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันChest Press เซต 2" }));
  expect(await screen.findByText(/สถิติใหม่ Chest Press: น้ำหนักมากสุด/)).toBeTruthy();
  // Set type, superset and an empty row that must not be confirmed.
  fireEvent.click(screen.getByRole("button", { name: "Chest Press เซต 2 ชนิด ปกติ" }));
  fireEvent.click(screen.getByRole("button", { name: "จนหมดแรง" }));
  fireEvent.click(screen.getByRole("button", { name: "ตัวเลือก Chest Press" }));
  fireEvent.click(screen.getByRole("button", { name: "ซูเปอร์เซตกับท่าถัดไป" }));
  expect(screen.getAllByText("ซูเปอร์เซต A")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "ยืนยันSeated Cable Row เซต 1" }));
  expect(await screen.findByText("กรอกน้ำหนักและจำนวนครั้งก่อนยืนยัน")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "จบการฝึก" }));
  const summary = await screen.findByRole("dialog", { name: "สรุปการฝึก" });
  expect(within(summary).getByText(/\+2.5 กก\. · ปริมาณ/)).toBeTruthy();
  expect(within(summary).getByRole("img", { name: /กล้ามเนื้อที่ใช้: อก/ })).toBeTruthy();
  const stored = (await allEntries()).find((e) => e.data.title === "Push Pull" && e.kind === "session")!.data;
  expect(stored.status).toBe("completed");
  expect(Date.parse(stored.endedAt)).toBeGreaterThanOrEqual(Date.parse(stored.startedAt));
  expect(stored.exercises[0].sets.map((set: any) => [set.load, set.reps, set.done, set.type])).toEqual([[20, 12, true, undefined], [25, 12, true, "failure"]]);
  expect(stored.exercises.map((x: any) => x.superset)).toEqual([1, 1]);
  expect(stored.exercises[1].sets[0].done).toBe(false);
});
it("keeps a program exercise that has no machine at this gym and offers to create it", async () => {
  const press = { name: "Chest Press", thai: "", gym: "WE Fitness", group: "อก", setup: "", cues: "", loadMode: "total" };
  await save("machine", press, "press");
  await save("machine", { ...press, name: "Seated Cable Row", group: "หลัง", gym: "M Fitness" }, "row-m");
  await save("machine", { ...press, name: "Leg Press", group: "ขา", archived: true }, "leg-old");
  await save("routine", { title: "Mixed", machineIds: ["press", "row-m", "leg-old"], days: [], folder: "WE",
    targets: { "row-m": { sets: 3, reps: 10 } } }, "routine-mixed");
  location.hash = "#today";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /Mixed.*WE · 3 ท่า/ }));
  const alerts = await screen.findAllByRole("alert");
  expect(alerts.map((a) => a.textContent)).toEqual(expect.arrayContaining([
    expect.stringMatching(/Seated Cable Row.*ยังไม่มีเครื่องที่ WE Fitness/),
    expect.stringMatching(/Leg Press.*เก็บเข้าคลังหรือลบแล้ว/),
  ]));
  expect(screen.getByRole("button", { name: /เริ่มบันทึก 1 ท่า/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "สร้างเครื่องที่นี่" }));
  expect(await screen.findByRole("button", { name: /เริ่มบันทึก 2 ท่า/ })).toBeTruthy();
  const made = (await allEntries()).find((e) => e.kind === "machine" && e.data.name === "Seated Cable Row" && e.data.gym === "WE Fitness");
  expect(made).toBeTruthy();
});
it("deletes any set, asks once more before deleting a confirmed one, and has no warm-up option", async () => {
  await save("machine", { name: "Chest Press", thai: "", gym: "WE Fitness", group: "อก", setup: "", cues: "", loadMode: "total" }, "press");
  await save("session", { date: today(), title: "Delete sets", status: "draft", note: "", exercises: [
    { machineId: "press", loadMode: "total", setup: "", note: "", sets: [
      { id: "a", load: 20, reps: 12, warmup: true, done: true },
      { id: "b", load: 20, reps: null, warmup: false, done: false }] }] }, "delete-sets");
  location.hash = "#today";
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "ทำต่อจากที่ค้างไว้" }));
  // An old warm-up flag shows as an ordinary numbered set.
  expect(await screen.findByRole("button", { name: "Chest Press เซต 1 ชนิด ปกติ" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Chest Press เซต 1 ชนิด ปกติ" }));
  expect(screen.queryByRole("button", { name: "วอร์ม" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "ลบChest Press เซต 2" }));
  await waitFor(() => expect(screen.queryByRole("spinbutton", { name: "Chest Press เซต 2 น้ำหนัก" })).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "ลบChest Press เซต 1" }));
  fireEvent.click(await screen.findByRole("button", { name: "ยืนยันลบChest Press เซต 1" }));
  await waitFor(async () => expect((await allEntries()).find((e) => e.id === "delete-sets")!.data.exercises[0].sets).toEqual([]));
});
it("copies the workout summary without clipboard permission, and shows the text when the browser blocks every way", async () => {
  await save("machine", { name: "Leg Press", thai: "", gym: "WE Fitness", group: "ขา", setup: "", cues: "", loadMode: "total" }, "leg");
  await save("session", { date: "2026-01-10", title: "Copy Me", status: "completed", note: "", exercises: [
    { machineId: "leg", loadMode: "total", setup: "", note: "", sets: [{ id: "a", load: 80, reps: 12, warmup: false, done: true }] }] }, "copy-me");
  const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: async () => { throw new DOMException("Write permission denied.", "NotAllowedError"); } } });
  let copied = "";
  const exec = vi.fn(() => { copied = (document.activeElement as HTMLTextAreaElement).value; return true; });
  document.execCommand = exec as any;
  try {
    location.hash = "#history";
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Copy Me/ }));
    fireEvent.click(await screen.findByRole("button", { name: "คัดลอกสรุปเวท" }));
    expect(await screen.findByText("คัดลอกสรุปเวทแล้ว")).toBeTruthy();
    expect(copied).toContain("Leg Press: 80 กก. × 12 ครั้ง");
    expect(document.querySelectorAll("textarea[readonly]")).toHaveLength(0);
    exec.mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "คัดลอกสรุปเวท" }));
    const box = await screen.findByLabelText("ข้อความที่จะคัดลอก") as HTMLTextAreaElement;
    expect(box.value).toContain("Leg Press: 80 กก. × 12 ครั้ง");
    expect(box.selectionEnd).toBe(box.value.length);
  } finally {
    Reflect.deleteProperty(document, "execCommand");
    if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});
it("edits sets, repetitions, rest and folder of a program", async () => {
  await save("machine", { name: "Leg Press", thai: "", gym: "WE Fitness", group: "ขา", setup: "", cues: "", loadMode: "total" }, "leg");
  await save("routine", { title: "Legs", machineIds: ["leg"], days: [], targets: { leg: { sets: 3, reps: 12, note: "ช้า" } } }, "legs");
  location.hash = "#settings";
  render(<App />);
  const row = (await screen.findByText("Legs")).closest<HTMLElement>(".trash-row")!;
  fireEvent.click(within(row).getByRole("button", { name: "แก้ไข" }));
  const dialog = await topDialog();
  fireEvent.change(dialog.getByLabelText("Leg Press จำนวนเซตเป้า"), { target: { value: "4" } });
  fireEvent.change(dialog.getByLabelText("Leg Press เวลาพัก"), { target: { value: "120" } });
  fireEvent.change(dialog.getByLabelText("โฟลเดอร์ (ถ้ามี)"), { target: { value: "WE" } });
  fireEvent.click(dialog.getByRole("button", { name: "บันทึกโปรแกรม" }));
  await waitFor(async () => expect((await allEntries()).find((e) => e.id === "legs")?.data).toMatchObject({
    folder: "WE", machineIds: ["leg"], targets: { leg: { sets: 4, reps: 12, note: "ช้า", rest: 120 } },
  }));
});
it("shows a client's workout without any control that could change it", async () => {
  const metadata = { version: 1, updatedAt: "2026-11-24T00:00:00Z", dirty: false };
  const close = vi.fn();
  render(
    <Data.Provider value={{
      readOnly: true, refresh: async () => {}, run: async (fn) => { await fn(); }, notify: () => {}, copy: async () => {},
      entries: [
        { ...metadata, id: "m", kind: "machine", data: { name: "Seated Cable Row", thai: "", gym: "M Fitness", group: "หลัง", setup: "", cues: "", loadMode: "total" } },
        { ...metadata, id: "s", kind: "session", data: { date: "2026-11-24", title: "Upper Body", status: "completed", note: "โน้ตลูกเทรน", exercises: [
          { machineId: "m", originalName: "Seated Row", loadMode: "total", setup: "เบาะ 3", note: "", sets: [
            { id: "1", load: 30, reps: 12, warmup: false, done: true }, { id: "2", load: 99, reps: 1, warmup: false, done: false }] },
        ] } },
      ],
    }}>
      <SessionEditor id="s" close={close} />
    </Data.Provider>,
  );
  const dialog = await topDialog();
  expect(dialog.getByText("30 กก. × 12 ครั้ง")).toBeTruthy();
  expect(dialog.getByText("บันทึกเดิม: Seated Row")).toBeTruthy();
  expect(dialog.getByText("โน้ตลูกเทรน")).toBeTruthy();
  expect(dialog.queryByText(/99/)).toBeNull();
  expect(dialog.queryAllByRole("textbox")).toHaveLength(0);
  expect(dialog.queryAllByRole("spinbutton")).toHaveLength(0);
  expect(dialog.getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual(["ปิด", "ดูสรุปและกล้ามเนื้อ", "คัดลอกสรุปเวท"]);
  fireEvent.click(dialog.getByRole("button", { name: "ปิด" }));
  expect(close).toHaveBeenCalledOnce();
});
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
