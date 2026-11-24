import type { Machine } from "./types";

const caution = "ยืดจนตึงพอดี หายใจตามปกติ ไหล่ไม่ยัก หยุดหากชาหรือเจ็บแปลบ";
export const stretchMoves = [
  ["home-stretch-wall-elbow", "Wall Chest Stretch (Elbow)", "ยืดอก ศอกพิงกำแพง", "งอศอกประมาณ 90° วางศอกและแขนท่อนล่างบนกำแพงระดับไหล่ แล้วก้าวไปด้านหน้าจนตึงพอดี"],
  ["home-stretch-wall-straight", "Wall Chest Stretch (Straight Arm)", "ยืดอก แขนตรงพิงกำแพง", "เหยียดแขนแนบกำแพงระดับไหล่ แล้วค่อย ๆ โน้มตัวไปด้านหน้า"],
  ["home-stretch-doorway", "Doorway Chest Stretch", "ยืดอก กรอบประตู", "วางแขนสองข้างบนกรอบประตูที่ระดับไหล่ แล้วก้าวผ่านกรอบประตูจนตึงพอดี"],
].map(([id, name, thai, instruction]) => ({
  id, name, thai, group: "Stretch", loadMode: "bodyweight",
  setup: id === "home-stretch-doorway" ? "สองข้างพร้อมกัน · 3 ครั้ง" : "ขวา 3 ครั้ง แล้วซ้าย 3 ครั้ง",
  cues: `${instruction}\n${caution}`,
} satisfies Omit<Machine, "gym"> & { id: string }));

export const chestStretchRoutine = {
  id: "routine-home-chest-stretch",
  data: { title: "Chest Stretch", machineIds: stretchMoves.map(({ id }) => id), days: [],
    note: "ค้าง 10 วินาที · พัก 10 วินาที · เปลี่ยนท่า 15 วินาที" },
};
export const isStretch = (id: string) => stretchMoves.some((move) => move.id === id);
