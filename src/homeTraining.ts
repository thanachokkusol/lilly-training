import type { Machine } from "./types";

export const homeGym = "ที่บ้าน";
export const retiredHomeRoutineId = "routine-home-full-body";
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
  { id: "home-db-lateral-raise", name: "Dumbbell Lateral Raise", thai: "ยกดัมเบลออกด้านข้าง", group: "ไหล่", loadMode: "per-side",
    setup: dumbbellPair,
    cues: "งอศอกเล็กน้อย ยกแขนออกด้านข้างเท่าที่คุมได้ประมาณระดับไหล่ แล้วลดช้า ๆ โดยไม่เหวี่ยงตัว" },
  { id: "home-db-shoulder-press", name: "Standing Dumbbell Shoulder Press", thai: "ยืนดันดัมเบลเหนือศีรษะ", group: "ไหล่", loadMode: "per-side",
    setup: dumbbellPair,
    cues: "เริ่มดัมเบลที่ไหล่ เกร็งลำตัว ดันขึ้นให้แขนอยู่เหนือไหล่โดยไม่แอ่นเอว แล้วลดกลับอย่างคุมได้" },
] satisfies Array<Pick<Machine, "name" | "thai" | "group" | "loadMode" | "setup" | "cues"> & { id: string }>;

const guides: Record<string, string> = {
  "goblet squat": "Goblet_Squat",
  "dumbbell floor press": "Dumbbell_Floor_Press",
  "bent over two-dumbbell row": "Bent_Over_Two-Dumbbell_Row",
  "glute bridge": "Butt_Lift_Bridge",
  "dead bug": "Dead_Bug",
  "chair squat": "Chair_Squat",
  "push-up": "Pushups",
  "dumbbell forward lunge": "Dumbbell_Lunges",
  "dumbbell biceps curl": "Dumbbell_Bicep_Curl",
  "hammer curl": "Hammer_Curls",
  "overhead dumbbell triceps extension": "Standing_Dumbbell_Triceps_Extension",
  "dumbbell triceps kickback": "Tricep_Dumbbell_Kickback",
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

const demoLinks: Record<string, string> = {
  "two-hand kettlebell swing": "https://www.acefitness.org/continuing-education/prosource/october-2015/5635/do-it-better-ace-s-technique-series-continues-with-the-two-handed-kettlebell-swing/",
  "kettlebell upright row": "https://www.catalystathletics.com/exercise/856/Kettlebell-Upright-Row/",
  "forward lunge": "https://www.acefitness.org/resources/everyone/exercise-library/equipment/no-equipment/?page=2",
};

export function exerciseDemoLink(name: string) {
  return demoLinks[name.trim().toLowerCase()];
}
