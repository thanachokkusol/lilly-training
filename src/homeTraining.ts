import type { Machine } from "./types";

export const homeGym = "ที่บ้าน";
export const retiredHomeRoutineId = "routine-home-full-body";
export const homeMoves = [
  { id: "home-goblet-squat", name: "Goblet Squat", thai: "สควอตถือเคตเทิลเบล", group: "ขา", loadMode: "total",
    setup: "เคตเทิลเบล 5 กก. หนึ่งลูก หรือเริ่มซ้อมโดยไม่ถือ",
    cues: "ถือลูกหน้าอก เท้าวางเต็มพื้น ย่อตัวให้เข่าไปทางเดียวกับปลายเท้า แล้วดันพื้นยืนขึ้น" },
  { id: "home-floor-press", name: "Dumbbell Floor Press", thai: "ดันดัมเบลบนพื้น", group: "อก", loadMode: "per-side",
    setup: "ดัมเบลคู่ 2.5 / 5 / 10 กก. ต่อข้าง ใช้ข้างละเท่ากัน",
    cues: "นอนหงาย งอเข่า เท้าราบพื้น ลดดัมเบลจนต้นแขนแตะพื้นเบา ๆ แล้วดันขึ้นโดยให้ข้อมือตรง" },
  { id: "home-dumbbell-row", name: "Bent Over Two-Dumbbell Row", thai: "ก้มดึงดัมเบลสองข้าง", group: "หลัง", loadMode: "per-side",
    setup: "ดัมเบลคู่ 2.5 / 5 / 10 กก. ต่อข้าง ใช้ข้างละเท่ากัน",
    cues: "ดันสะโพกไปด้านหลัง งอเข่าเล็กน้อย คงแนวหลังไว้ ดึงศอกไปด้านหลังแล้วลดดัมเบลช้า ๆ" },
  { id: "home-glute-bridge", name: "Glute Bridge", thai: "สะพานสะโพก", group: "ขา", loadMode: "bodyweight",
    setup: "พื้นราบ ใช้น้ำหนักตัว",
    cues: "นอนหงาย งอเข่า เท้าราบ ดันพื้นยกสะโพกโดยไม่แอ่นเอว แล้วลดสะโพกลงช้า ๆ" },
  { id: "home-dead-bug", name: "Dead Bug", thai: "เหยียดแขนขาสลับข้าง", group: "แกนกลาง", loadMode: "bodyweight",
    setup: "พื้นราบ ใช้น้ำหนักตัว · นับจำนวนครั้งรวมสองข้าง",
    cues: "นอนหงายยกแขนและงอสะโพกกับเข่า ค่อย ๆ เหยียดแขนและขาฝั่งตรงข้าม คุมเอวให้นิ่ง แล้วสลับข้าง" },
  { id: "home-chair-squat", name: "Chair Squat", thai: "ลุกนั่งจากเก้าอี้", group: "ขา", loadMode: "bodyweight",
    setup: "ใช้เก้าอี้มั่นคง วางชิดผนังได้",
    cues: "วางเท้าราบ ดันสะโพกไปด้านหลัง แตะที่นั่งเบา ๆ แล้วกดเท้ายืนขึ้นโดยคุมเข่าไปทางเดียวกับปลายเท้า" },
] satisfies Array<Pick<Machine, "name" | "thai" | "group" | "loadMode" | "setup" | "cues"> & { id: string }>;

const guides: Record<string, string> = {
  "goblet squat": "Goblet_Squat",
  "dumbbell floor press": "Dumbbell_Floor_Press",
  "bent over two-dumbbell row": "Bent_Over_Two-Dumbbell_Row",
  "glute bridge": "Butt_Lift_Bridge",
  "dead bug": "Dead_Bug",
  "chair squat": "Chair_Squat",
  "chest press": "Machine_Bench_Press",
  "lat pulldown": "Wide-Grip_Lat_Pulldown",
  "leg press": "Leg_Press",
  "abdominal crunch": "Ab_Crunch_Machine",
  "seated cable row": "Seated_Cable_Rows",
  "seated row": "Seated_Cable_Rows",
  "cable triceps pushdown": "Triceps_Pushdown",
};

export function exerciseGuide(name: string) {
  return guides[name.normalize("NFKC").trim().toLowerCase()];
}
