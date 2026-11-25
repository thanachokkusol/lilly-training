import type { Entry, ExerciseTarget, Machine } from "./types";
import { cooldownStretches } from "./stretchTraining";

export const homeGym = "ที่บ้าน";
const retiredHomeRoutineId = "routine-home-full-body";
const originalRoutineMoves = ["home-goblet-squat", "home-floor-press", "home-dumbbell-row", "home-glute-bridge", "home-dead-bug"];
export function isObsoleteHomeRoutine(entry: Entry) {
  const { data } = entry;
  return entry.id === retiredHomeRoutineId && entry.kind === "routine" && !entry.deleted &&
    !entry.conflict && !data.retiredBy &&
    data.title === "ที่บ้าน · เวททั้งตัว" && data.note === "เลือกน้ำหนักที่คุมท่าได้ บันทึกเฉพาะเซ็ตที่ทำจริง" &&
    data.days?.length === 0 && Array.isArray(data.machineIds) &&
    data.machineIds.length > 0 && data.machineIds.every((id: string) => originalRoutineMoves.includes(id));
}
const dumbbellPair = "ดัมเบลคู่ 2.5 / 5 / 10 กก. ต่อข้าง เลือกเท่ากันทั้งสองข้าง";
const kettlebell = "เคตเทิลเบล 5 กก. หนึ่งลูก";
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
  { id: "home-db-deadlift", name: "Stiff-Legged Dumbbell Deadlift", thai: "ก้มพับสะโพกถือดัมเบล", group: "ขา", loadMode: "per-side",
    setup: dumbbellPair,
    cues: "ยืนกว้างเท่าสะโพก งอเข่าเล็กน้อยค้างไว้ ดันสะโพกไปด้านหลัง ดัมเบลใกล้ขา ลดลงเท่าที่หลังยังตรงและตึงหลังขา แล้วบีบก้นยืนขึ้น" },
  { id: "home-kb-swing", name: "Two-Hand Kettlebell Swing", thai: "เหวี่ยงเคตเทิลเบลสองมือ", group: "ขา", loadMode: "total",
    setup: kettlebell + " · เว้นพื้นที่ด้านหน้า",
    cues: "จับสองมือ พับสะโพกให้ลูกผ่านระหว่างขา จากนั้นเหยียดสะโพกให้ลูกลอยถึงระดับอก ผ่อนแขน และพับสะโพกรับจังหวะลง" },
  { id: "home-kb-upright-row", name: "Kettlebell Upright Row", thai: "ยืนดึงเคตเทิลเบลขึ้นหน้าอก", group: "ไหล่", loadMode: "total",
    setup: kettlebell,
    cues: "ถือสองมือหน้าต้นขา ยืนนิ่ง ดึงลูกใกล้ลำตัวโดยให้ศอกออกด้านข้าง ยกถึงระดับอกเท่าที่สบาย ไม่ฝืนดึงถึงคาง แล้วลดลงช้า ๆ" },
  { id: "home-kb-high-pull", name: "Kettlebell Sumo High Pull", thai: "ย่อขากว้างแล้วดึงเคตเทิลเบล", group: "ขา", loadMode: "total",
    setup: kettlebell,
    cues: "ยืนกว้าง จับลูกระหว่างเท้า เหยียดขาและสะโพกก่อนดึงศอกออกด้านข้าง คุมลูกกลับลง จังหวะดึงเกิดหลังการยืนขึ้น" },
  { id: "home-push-up", name: "Push-up", thai: "วิดพื้น", group: "อก", loadMode: "bodyweight",
    setup: "พื้นราบ ใช้น้ำหนักตัว",
    cues: "มือกว้างกว่าไหล่เล็กน้อย คุมศีรษะ ลำตัวและสะโพกให้เป็นแนว ลดอกลงอย่างคุมได้แล้วดันพื้นขึ้น" },
  { id: "home-forward-lunge", name: "Forward Lunge", thai: "ลันจ์ก้าวหน้า", group: "ขา", loadMode: "bodyweight",
    setup: "พื้นราบ ใช้น้ำหนักตัว · นับจำนวนครั้งรวมสองข้าง",
    cues: "ก้าวเท้าข้างหนึ่งไปข้างหน้า ลงน้ำหนักเต็มฝ่าเท้า งอเข่าทั้งสองให้ตัวลงตรง ๆ แล้วกดเท้าหน้ากลับมายืน สลับข้าง" },
  { id: "home-dumbbell-lunge", name: "Dumbbell Forward Lunge", thai: "ลันจ์ก้าวหน้าถือดัมเบล", group: "ขา", loadMode: "per-side",
    setup: dumbbellPair + " · นับจำนวนครั้งรวมสองข้าง",
    cues: "ถือดัมเบลข้างตัว ก้าวไปข้างหน้า งอเข่าทั้งสองโดยคุมตัวให้ตรง แล้วกดเท้าหน้ากลับมายืน" },
  { id: "home-db-curl", name: "Dumbbell Biceps Curl", thai: "งอแขนดัมเบลหงายมือ", group: "แขน", loadMode: "per-side",
    setup: dumbbellPair,
    cues: "หงายฝ่ามือ เก็บศอกข้างตัว งอแขนโดยไม่เหวี่ยงตัว แล้วค่อย ๆ เหยียดกลับ" },
  { id: "home-hammer-curl", name: "Hammer Curl", thai: "งอแขนดัมเบลจับค้อน", group: "แขน", loadMode: "per-side",
    setup: dumbbellPair,
    cues: "ให้ฝ่ามือหันเข้าหากัน คงศอกข้างตัว งอแขนแล้วลดลงโดยไม่แกว่งไหล่" },
  { id: "home-db-triceps-extension", name: "Overhead Dumbbell Triceps Extension", thai: "เหยียดแขนหลังศีรษะ", group: "แขน", loadMode: "total",
    setup: "ดัมเบลหนึ่งลูก 2.5 / 5 / 10 กก. ถือสองมือ",
    cues: "จับดัมเบลให้มั่น ยกเหนือศีรษะแล้วงอเฉพาะข้อศอกให้ลูกลดหลังศีรษะ จากนั้นเหยียดขึ้น คุมซี่โครงและเอวให้นิ่ง" },
  { id: "home-db-kickback", name: "Dumbbell Triceps Kickback", thai: "เหยียดแขนดัมเบลไปด้านหลัง", group: "แขน", loadMode: "total",
    setup: "ดัมเบลหนึ่งลูก ทำทีละข้าง · บันทึกเซ็ตตามจำนวนครั้งที่ทำจริง",
    cues: "พับสะโพกและพยุงตัวให้มั่น คงต้นแขนชิดลำตัว เหยียดข้อศอกให้มือไปด้านหลัง แล้วค่อยงอกลับ" },
  { id: "home-db-concentration-curl", name: "Dumbbell Concentration Curl", thai: "นั่งงอแขนดัมเบลพิงต้นขา", group: "แขน", loadMode: "total",
    setup: "เก้าอี้มั่นคงและดัมเบลหนึ่งลูก ทำทีละข้าง",
    cues: "นั่งเท้าราบ พิงต้นแขนด้านในต้นขา หงายมือ งอศอกให้ดัมเบลขึ้นโดยคงต้นแขนไว้ แล้วลดลงช้า ๆ" },
  { id: "home-db-reverse-curl", name: "Dumbbell Reverse Curl", thai: "งอแขนดัมเบลคว่ำมือ", group: "แขน", loadMode: "per-side",
    setup: dumbbellPair,
    cues: "คว่ำมือถือดัมเบลหน้าต้นขา เก็บศอกข้างตัว งอศอกโดยรักษาข้อมือตรง แล้วลดลงช้า ๆ" },
  { id: "home-db-lying-extension", name: "Lying Dumbbell Triceps Extension", thai: "นอนเหยียดแขนดัมเบล", group: "แขน", loadMode: "per-side",
    setup: dumbbellPair + " · ใช้พื้นราบ",
    cues: "นอนหงาย เท้าราบ ยกดัมเบลเหนือไหล่ ฝ่ามือเข้าหากัน คงต้นแขนไว้ งอศอกให้ลูกลงข้างศีรษะ แล้วเหยียดขึ้นช้า ๆ" },
  { id: "home-crunch", name: "Crunch", thai: "ครันช์บนพื้น", group: "แกนกลาง", loadMode: "bodyweight",
    setup: "พื้นราบ ใช้น้ำหนักตัว",
    cues: "นอนหงาย งอเข่า เท้าราบ หายใจออกขณะเกร็งท้องยกสะบักจากพื้นเล็กน้อย แล้วลดลงช้า ๆ โดยไม่ดึงคอ" },
  { id: "home-side-hip-abduction", name: "Side-Lying Hip Abduction", thai: "นอนตะแคงยกขาด้านข้าง", group: "ขา", loadMode: "bodyweight",
    setup: "พื้นราบ ใช้น้ำหนักตัว ทำทั้งสองข้าง",
    cues: "นอนตะแคงให้สะโพกซ้อนกัน เหยียดขาบน ยกขาขึ้นด้านข้างโดยไม่หมุนสะโพกหรือหงายปลายเท้า แล้วลดลงช้า ๆ" },
  { id: "home-db-lateral-raise", name: "Dumbbell Lateral Raise", thai: "ยกดัมเบลออกด้านข้าง", group: "ไหล่", loadMode: "per-side",
    setup: dumbbellPair,
    cues: "งอศอกเล็กน้อย ยกแขนออกด้านข้างเท่าที่คุมได้ประมาณระดับไหล่ แล้วลดช้า ๆ โดยไม่เหวี่ยงตัว" },
  { id: "home-db-shoulder-press", name: "Standing Dumbbell Shoulder Press", thai: "ยืนดันดัมเบลเหนือศีรษะ", group: "ไหล่", loadMode: "per-side",
    setup: dumbbellPair,
    cues: "เริ่มดัมเบลที่ไหล่ เกร็งลำตัว ดันขึ้นให้แขนอยู่เหนือไหล่โดยไม่แอ่นเอว แล้วลดกลับอย่างคุมได้" },
] satisfies Array<Pick<Machine, "name" | "thai" | "group" | "loadMode" | "setup" | "cues"> & { id: string }>;

export const homeCoachRoutine = {
  id: "routine-home-coach",
  data: {
    title: "Coach Plan · Home",
    machineIds: ["home-floor-press", "home-dumbbell-row", "home-db-kickback", "home-goblet-squat", "home-side-hip-abduction", "home-crunch"],
    days: [],
    note: "ดัดแปลงจากบันทึก WE Upper / Lower: Floor Press แทน Chest Press, Dumbbell Row ใช้ฝึกกล้ามเนื้อหลังแทน Lat Pulldown และ Seated Row, Kickback แทน Cable Pushdown, Goblet Squat แทน Leg Press, Side-Lying Hip Abduction แทนเครื่องกางขา และ Crunch แทนเครื่องหน้าท้อง\nบันทึกโค้ช: เน้นฟอร์ม 3 เซต × 8–12 ครั้ง ไม่นับวอร์ม · สำหรับ Cable Pushdown โค้ชระบุ 2 เซต × 10–12 ครั้ง ใช้เป็นแนวทางสำหรับ Kickback ที่บ้าน",
  },
};

const legsTargets: Record<string, ExerciseTarget> = {
  "home-goblet-squat": { sets: 3, reps: 12, note: "เคตเทิลเบล 5 กก. · ลง 3 วินาที ขึ้นช้า ๆ" },
  "home-db-deadlift": { sets: 3, reps: 10, note: "เริ่ม 5 กก./ข้าง ฟอร์มนิ่งค่อยขึ้น 10" },
  "home-dumbbell-lunge": { sets: 2, reps: 16, note: "ข้างละ 8 ครั้ง · เริ่ม 2.5 กก./ข้าง" },
  "home-side-hip-abduction": { sets: 2, reps: 24, note: "ข้างละ 12 ครั้ง · น้ำหนักตัว" },
  "home-floor-press": { sets: 3, reps: 10, note: "เริ่ม 5 กก./ข้าง ยังเหลือแรงค่อยขึ้น 10" },
  "home-crunch": { sets: 3, reps: 12, note: "น้ำหนักตัว · ไม่ดึงคอ" },
  "home-dead-bug": { sets: 2, reps: 16, note: "ข้างละ 8 ครั้ง · หลังล่างติดพื้น" },
};
export const homeLegsRoutine = {
  id: "routine-home-legs-core-chest",
  data: {
    title: "Home · ขา + แกนกลาง + อก",
    machineIds: [...Object.keys(legsTargets), ...cooldownStretches],
    targets: legsTargets,
    days: [],
    note: "ลิลลี่จัดตามแนวโค้ช: เน้นฟอร์ม เหลือแรงอีก 2–3 ครั้งต่อเซต · 18 เซต ประมาณ 40 นาที + ยืด 12 นาที\n" +
      "วอร์ม 5 นาที: ย่ำเท้าอยู่กับที่ แล้ว Chair Squat กับพับสะโพกมือเปล่าอย่างละ 10 ครั้ง (ไม่นับเซต)\n" +
      "พัก 60–90 วินาทีต่อเซต · จำนวนครั้งที่เติมไว้เป็นเป้า แก้เป็นที่ทำจริงก่อนกดยืนยัน\n" +
      "เล่นเวทครบแล้วกด “เปิดตัวจับเวลา Stretch” · หยุดถ้าเจ็บแปลบ ชา หรือเวียนหัว",
  },
};

const guides: Record<string, string> = {
  "stiff-legged dumbbell deadlift": "Stiff_Legged_Dumbbell_Deadlift",
  "kneeling hip flexor stretch": "Kneeling_Hip_Flexor",
  "side-lying quad stretch": "Side_Lying_Quad_Stretch",
  "seated hamstring stretch": "Seated_Floor_Hamstring_Stretch",
  "figure-four glute stretch": "Ankle_On_The_Knee",
  "wall calf stretch": "Calf_Stretch_Hands_Against_Wall",
  "child's pose": "Childs_Pose",
  "goblet squat": "Goblet_Squat",
  "dumbbell floor press": "Dumbbell_Floor_Press",
  "bent over two-dumbbell row": "Bent_Over_Two-Dumbbell_Row",
  "glute bridge": "Butt_Lift_Bridge",
  "dead bug": "Dead_Bug",
  "chair squat": "Chair_Squat",
  "push-up": "Pushups",
  "two-hand kettlebell swing": "Kettlebell_Swing",
  "kettlebell upright row": "Kettlebell_Upright_Row",
  "forward lunge": "Forward_Lunge",
  "wall chest stretch (elbow)": "Wall_Chest_Stretch_Elbow",
  "dumbbell forward lunge": "Dumbbell_Lunges",
  "dumbbell biceps curl": "Dumbbell_Bicep_Curl",
  "hammer curl": "Hammer_Curls",
  "overhead dumbbell triceps extension": "Standing_Dumbbell_Triceps_Extension",
  "dumbbell triceps kickback": "Tricep_Dumbbell_Kickback",
  "dumbbell concentration curl": "Concentration_Curls",
  "dumbbell reverse curl": "Standing_Dumbbell_Reverse_Curl",
  "lying dumbbell triceps extension": "Lying_Dumbbell_Tricep_Extension",
  "crunch": "Crunches",
  "side-lying hip abduction": "Side_Lying_Leg_Raise",
  "dumbbell lateral raise": "Side_Lateral_Raise",
  "standing dumbbell shoulder press": "Standing_Dumbbell_Press",
  "kettlebell sumo high pull": "Kettlebell_Sumo_High_Pull",
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

export function exerciseGuideFrames(guide: string) {
  return ["Kettlebell_Upright_Row", "Wall_Chest_Stretch_Elbow", "Kneeling_Hip_Flexor", "Side_Lying_Quad_Stretch",
    "Seated_Floor_Hamstring_Stretch", "Ankle_On_The_Knee", "Calf_Stretch_Hands_Against_Wall", "Childs_Pose"]
    .includes(guide) ? [0] : [0, 1];
}

const demoLinks: Record<string, string> = {
  "two-hand kettlebell swing": "https://www.acefitness.org/continuing-education/prosource/october-2015/5635/do-it-better-ace-s-technique-series-continues-with-the-two-handed-kettlebell-swing/",
  "kettlebell upright row": "https://www.catalystathletics.com/exercise/856/Kettlebell-Upright-Row/",
  "forward lunge": "https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/?page=2",
};

export function exerciseDemoLink(name: string) {
  return demoLinks[name.trim().toLowerCase()];
}
