import type { Machine } from "./types";

/** Seconds and repetitions per side. Chest stretches keep the coach's 10 seconds × 3. */
export function stretchTiming(id: string) {
  const chest = /^home-stretch-(wall-|doorway)/.test(id);
  return {
    both: id === "home-stretch-doorway" || id === "home-stretch-child",
    hold: chest ? 10 : 20,
    reps: chest ? 3 : 2,
    rest: chest ? 10 : 5,
  };
}
const caution = "ยืดจนตึงพอดี หายใจตามปกติ ไหล่ไม่ยัก หยุดหากชาหรือเจ็บแปลบ";
export const stretchMoves = [
  ["home-stretch-wall-elbow", "Wall Chest Stretch (Elbow)", "ยืดอก ศอกพิงกำแพง", "งอศอกประมาณ 90° วางศอกและแขนท่อนล่างบนกำแพงระดับไหล่ แล้วก้าวไปด้านหน้าจนตึงพอดี"],
  ["home-stretch-wall-straight", "Wall Chest Stretch (Straight Arm)", "ยืดอก แขนตรงพิงกำแพง", "เหยียดแขนแนบกำแพงระดับไหล่ แล้วค่อย ๆ โน้มตัวไปด้านหน้า"],
  ["home-stretch-doorway", "Doorway Chest Stretch", "ยืดอก กรอบประตู", "วางแขนสองข้างบนกรอบประตูที่ระดับไหล่ แล้วก้าวผ่านกรอบประตูจนตึงพอดี"],
  // New moves go at the end: a timer already running on a device refers to moves by position.
  ["home-stretch-hip-flexor", "Kneeling Hip Flexor Stretch", "ยืดหน้าสะโพก คุกเข่า", "คุกเข่าข้างหนึ่งบนเบาะนุ่ม อีกข้างวางเท้าหน้า ลำตัวตรง ค่อย ๆ ดันสะโพกไปด้านหน้าจนตึงหน้าสะโพกของขาหลัง"],
  ["home-stretch-quad", "Side-Lying Quad Stretch", "ยืดหน้าขา นอนตะแคง", "นอนตะแคง งอเข่าขาบนแล้วจับข้อเท้า ดึงส้นเท้าเข้าหาก้นเบา ๆ เข่าชี้ไปด้านหน้า ไม่แอ่นเอว"],
  ["home-stretch-hamstring", "Seated Hamstring Stretch", "ยืดหลังขา นั่งพื้น", "นั่งเหยียดขาข้างหนึ่ง งออีกข้างให้ฝ่าเท้าชิดต้นขา โน้มตัวจากสะโพกไปหาปลายเท้าโดยหลังไม่งอมาก"],
  ["home-stretch-figure-four", "Figure-Four Glute Stretch", "ยืดก้น ไขว่ขาเลขสี่", "นอนหงาย วางข้อเท้าข้างหนึ่งบนเข่าอีกข้าง จับหลังต้นขาขาล่างแล้วดึงเข้าหาอก ศีรษะและไหล่วางบนพื้น"],
  ["home-stretch-calf", "Wall Calf Stretch", "ยืดน่อง พิงกำแพง", "ยันมือกับกำแพง ก้าวขาข้างหนึ่งไปด้านหลัง เข่าหลังตรง กดส้นเท้าติดพื้น แล้วโน้มตัวไปด้านหน้า"],
  ["home-stretch-child", "Child's Pose", "ยืดหลัง ท่าเด็ก", "คุกเข่า นั่งก้นลงหาส้นเท้า ยืดแขนไปด้านหน้า วางหน้าผากใกล้พื้น หายใจช้า ๆ ข้ามท่านี้ถ้าเข่าไม่สบาย"],
].map(([id, name, thai, instruction]) => ({
  id, name, thai, group: "Stretch", loadMode: "bodyweight",
  setup: stretchTiming(id).both ? `สองข้างพร้อมกัน · ${stretchTiming(id).reps} ครั้ง`
    : `ขวา ${stretchTiming(id).reps} ครั้ง แล้วซ้าย ${stretchTiming(id).reps} ครั้ง`,
  cues: `${instruction}\n${caution}`,
} satisfies Omit<Machine, "gym"> & { id: string }));

export const chestStretchRoutine = {
  id: "routine-home-chest-stretch",
  data: { title: "Chest Stretch", machineIds: ["home-stretch-wall-elbow", "home-stretch-wall-straight", "home-stretch-doorway"], days: [],
    note: "ค้าง 10 วินาที · พัก 10 วินาที · เปลี่ยนท่า 15 วินาที" },
};
/** After the home leg, core and chest program; about 12 minutes in the timer. */
export const cooldownStretches = ["home-stretch-hip-flexor", "home-stretch-quad", "home-stretch-hamstring",
  "home-stretch-figure-four", "home-stretch-calf", "home-stretch-wall-elbow", "home-stretch-child"];
export const isStretch = (id: string) => stretchMoves.some((move) => move.id === id);
