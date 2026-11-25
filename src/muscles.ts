import { catalogLinks } from "./catalogLinks";
import type { Machine } from "./types";

export const muscleLabels = {
  chest: "อก",
  shoulders: "ไหล่",
  triceps: "หลังแขน",
  biceps: "หน้าแขน",
  forearms: "ปลายแขน",
  lats: "ปีก",
  upper_back: "หลังบน",
  lower_back: "หลังล่าง",
  traps: "บ่า",
  neck: "คอ",
  abdominals: "หน้าท้อง",
  glutes: "ก้น",
  quadriceps: "หน้าขา",
  hamstrings: "หลังขา",
  calves: "น่อง",
  abductors: "กางสะโพก",
  adductors: "ขาหนีบ",
  full_body: "ทั้งตัว",
  other: "อื่นๆ",
} as const;
export type Muscle = keyof typeof muscleLabels;
export const muscleIds = Object.keys(muscleLabels) as Muscle[];
export const isMuscle = (value: unknown): value is Muscle => typeof value === "string" && value in muscleLabels;

/** What training a muscle helps with, in plain words. */
export const muscleBenefits: Partial<Record<Muscle, string>> = {
  chest: "แรงดันไปข้างหน้า เช่น วิดพื้น ผลักประตู",
  shoulders: "แรงยกแขนและความมั่นคงของหัวไหล่",
  triceps: "แรงเหยียดศอก ใช้ในท่าดันทุกท่า",
  biceps: "แรงงอศอก ใช้ในท่าดึงและยกของ",
  forearms: "แรงจับและข้อมือ",
  lats: "แรงดึงลง หลังกว้างเป็นรูปตัววี",
  upper_back: "แรงดึงเข้าหาตัว ช่วยให้ไหล่ไม่ห่อ",
  lower_back: "ประคองลำตัวเวลาก้มและยก",
  traps: "ประคองบ่าและสะบัก",
  neck: "ประคองศีรษะและคอ",
  abdominals: "แกนกลาง ประคองลำตัวและเอว",
  glutes: "แรงเหยียดสะโพก ลุก เดินขึ้นบันได และทรงตัว",
  quadriceps: "แรงเหยียดเข่า ลุกนั่งและขึ้นบันได",
  hamstrings: "แรงงอเข่าและพับสะโพก ช่วยสมดุลกับหน้าขา",
  calves: "แรงถีบปลายเท้า เดินและวิ่ง",
  abductors: "กางขาและทรงตัวขาเดียว",
  adductors: "หนีบขาและทรงตัวด้านข้าง",
  full_body: "ใช้หลายส่วนพร้อมกัน ได้แรงและความอึด",
};

export type MuscleSplit = { primary: Muscle[]; secondary: Muscle[] };
const none: MuscleSplit = { primary: [], secondary: [] };
const split = (primary: string, secondary = ""): MuscleSplit => ({
  primary: primary.split(" ").filter(Boolean) as Muscle[],
  secondary: secondary.split(" ").filter(Boolean) as Muscle[],
});
// First match wins, so the specific names come before the general ones.
const rules: [RegExp, MuscleSplit][] = [
  [/stretch|child'?s pose/, none],
  [/leg extension.*leg curl|leg curl.*leg extension/, split("quadriceps hamstrings")],
  [/pec fly.*rear delt|rear delt.*pec fly/, split("chest shoulders", "upper_back")],
  [/glute kickback|hip thrust|glute bridge|butt lift/, split("glutes", "hamstrings")],
  [/hip abduction|abductor|clamshell/, split("abductors", "glutes")],
  [/hip adduction|adductor/, split("adductors")],
  [/calf|calves/, split("calves")],
  [/leg curl|hamstring curl/, split("hamstrings", "calves")],
  [/leg extension/, split("quadriceps")],
  [/stiff.?leg|romanian|\brdl\b/, split("hamstrings", "glutes lower_back")],
  [/deadlift/, split("glutes", "hamstrings lower_back upper_back quadriceps")],
  [/swing|high pull|clean|snatch/, split("full_body", "glutes hamstrings shoulders")],
  [/good morning/, split("hamstrings", "lower_back glutes")],
  [/squat|leg press|lunge|step.?up/, split("quadriceps", "glutes hamstrings adductors")],
  [/back extension|hyperextension/, split("lower_back", "glutes hamstrings")],
  [/crunch|sit.?up|abdominal|plank|dead bug|(hanging|lying|knee) .*raise|leg raise|russian twist|side bend|oblique/, split("abdominals")],
  [/face pull|rear delt|reverse (pec|fly|machine)/, split("shoulders", "upper_back traps")],
  [/upright row/, split("shoulders", "traps biceps")],
  [/shrug/, split("traps", "forearms")],
  [/lateral raise|front raise/, split("shoulders")],
  [/shoulder press|overhead press|military|arnold/, split("shoulders", "triceps traps")],
  [/incline/, split("chest", "shoulders triceps")],
  [/pec|butterfly|chest fly|cable fly|\bflye?s?\b/, split("chest", "shoulders")],
  [/chest press|bench press|floor press|push.?up/, split("chest", "triceps shoulders")],
  [/pulldown|pull.?up|chin.?up|pull.?over/, split("lats", "biceps upper_back forearms")],
  [/\bdips?\b/, split("triceps", "chest shoulders")],
  [/\brows?\b/, split("upper_back", "lats biceps")],
  [/triceps?|push.?down|kickback|skull/, split("triceps")],
  [/wrist/, split("forearms")],
  [/reverse curl|hammer/, split("biceps", "forearms")],
  [/curl/, split("biceps", "forearms")],
];
const byGroup: Record<string, MuscleSplit> = {
  อก: split("chest"),
  หลัง: split("upper_back"),
  แกนกลาง: split("abdominals"),
  ไหล่: split("shoulders"),
};
// Names used before the universal list.
const legacy: Record<string, Muscle> = { deltoids: "shoulders", forearm: "forearms", trapezius: "traps", "upper-back": "upper_back",
  "lower-back": "lower_back", abs: "abdominals", obliques: "abdominals", gluteal: "glutes", hamstring: "hamstrings" };
const clean = (list: string[]) => [...new Set(list.map((muscle) => legacy[muscle] ?? muscle).filter(isMuscle))];
type Named = Pick<Machine, "name" | "group"> & Partial<Pick<Machine, "muscles" | "trains" | "catalogId" | "category">>;
const normalized = (name: string) => name.normalize("NFKC").trim().toLowerCase();
/** The universal exercise of a machine: its own choice, otherwise the known name. An empty choice means none. */
export const catalogIdOf = (machine: Named | undefined) =>
  !machine ? undefined : machine.catalogId !== undefined ? machine.catalogId || undefined : catalogLinks[normalized(machine.name)]?.id;
/** The person's own choice first, then the universal exercise, then the name. An unclear machine stays unknown. */
export function musclesFor(machine: Named | undefined): MuscleSplit {
  if (!machine) return none;
  const own = machine.trains ?? machine.muscles;
  if (own && (own.primary.length || own.secondary.length))
    return { primary: clean(own.primary), secondary: clean(own.secondary) };
  const link = catalogLinks[normalized(machine.name)];
  if (link && catalogIdOf(machine) === link.id) return { primary: [link.primary], secondary: link.secondary };
  return rules.find(([pattern]) => pattern.test(normalized(machine.name)))?.[1] ?? byGroup[machine.group] ?? none;
}
export const muscleText = (muscles: Muscle[]) => muscles.map((muscle) => muscleLabels[muscle]).join(" · ");

export const stretchCategory = "stretch";
export type Category = Muscle | typeof stretchCategory;
export const categoryLabel = (category: string) =>
  category === stretchCategory ? "ยืดเหยียด" : isMuscle(category) ? muscleLabels[category] : "อื่นๆ";
/** One category per machine, the main muscle of the universal list. */
export function categoryOf(machine: Named): Category {
  if (machine.group === "Stretch") return stretchCategory;
  if (isMuscle(machine.category)) return machine.category;
  return musclesFor(machine).primary[0] ?? "other";
}
/** The old Thai group is still saved beside the category, so older copies of the app keep working. */
export const legacyGroup = (category: string) => ({
  chest: "อก", lats: "หลัง", upper_back: "หลัง", lower_back: "หลัง", traps: "หลัง", shoulders: "ไหล่", abdominals: "แกนกลาง",
  triceps: "แขน", biceps: "แขน", forearms: "แขน", glutes: "ขา", quadriceps: "ขา", hamstrings: "ขา", calves: "ขา", abductors: "ขา", adductors: "ขา",
} as Record<string, string>)[category] ?? "อื่น ๆ";
export const legMuscles: string[] = ["glutes", "quadriceps", "hamstrings", "calves", "abductors", "adductors"];
