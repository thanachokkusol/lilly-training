import type { Machine } from "./types";

export const muscleLabels = {
  chest: "อก",
  deltoids: "ไหล่",
  triceps: "หลังแขน",
  biceps: "หน้าแขน",
  forearm: "แขนท่อนล่าง",
  trapezius: "บ่า",
  "upper-back": "หลัง (ปีก)",
  "lower-back": "หลังล่าง",
  abs: "หน้าท้อง",
  obliques: "ข้างลำตัว",
  gluteal: "ก้น",
  quadriceps: "หน้าขา",
  hamstring: "หลังขา",
  adductors: "ขาด้านใน",
  calves: "น่อง",
} as const;
export type Muscle = keyof typeof muscleLabels;
export const muscleIds = Object.keys(muscleLabels) as Muscle[];

/** What training a muscle helps with, in plain words. */
export const muscleBenefits: Record<Muscle, string> = {
  chest: "แรงดันไปข้างหน้า เช่น วิดพื้น ผลักประตู",
  deltoids: "แรงยกแขนและความมั่นคงของหัวไหล่",
  triceps: "แรงเหยียดศอก ใช้ในท่าดันทุกท่า",
  biceps: "แรงงอศอก ใช้ในท่าดึงและยกของ",
  forearm: "แรงจับและข้อมือ",
  trapezius: "ประคองบ่าและสะบัก",
  "upper-back": "แรงดึง หลังกว้าง ช่วยให้ยืนหลังตรง",
  "lower-back": "ประคองลำตัวเวลาก้มและยก",
  abs: "แกนกลาง ประคองลำตัวและเอว",
  obliques: "การบิดและประคองลำตัวด้านข้าง",
  gluteal: "แรงเหยียดสะโพก ลุก เดินขึ้นบันได และทรงตัว",
  quadriceps: "แรงเหยียดเข่า ลุกนั่งและขึ้นบันได",
  hamstring: "แรงงอเข่าและพับสะโพก ช่วยสมดุลกับหน้าขา",
  adductors: "หนีบขาและทรงตัวด้านข้าง",
  calves: "แรงถีบปลายเท้า เดินและวิ่ง",
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
  [/leg extension.*leg curl|leg curl.*leg extension/, split("quadriceps hamstring")],
  [/pec fly.*rear delt|rear delt.*pec fly/, split("chest deltoids", "upper-back")],
  [/glute kickback|hip thrust|glute bridge|butt lift/, split("gluteal", "hamstring")],
  [/hip abduction|abductor|clamshell/, split("gluteal")],
  [/hip adduction|adductor/, split("adductors")],
  [/calf|calves/, split("calves")],
  [/leg curl|hamstring curl/, split("hamstring", "calves")],
  [/leg extension/, split("quadriceps")],
  [/sumo high pull/, split("gluteal quadriceps", "hamstring deltoids trapezius")],
  [/stiff.?leg|romanian|\brdl\b/, split("hamstring gluteal", "lower-back")],
  [/deadlift/, split("gluteal hamstring", "lower-back upper-back quadriceps")],
  [/swing/, split("gluteal hamstring", "lower-back abs deltoids")],
  [/good morning/, split("hamstring lower-back", "gluteal")],
  [/squat|leg press|lunge|step.?up/, split("quadriceps gluteal", "hamstring adductors")],
  [/back extension|hyperextension/, split("lower-back", "gluteal hamstring")],
  [/russian twist|side bend|oblique/, split("obliques", "abs")],
  [/crunch|sit.?up|abdominal|plank|dead bug|(hanging|lying|knee) .*raise|leg raise/, split("abs", "obliques")],
  [/face pull|rear delt|reverse (pec|fly|machine)/, split("deltoids", "upper-back trapezius")],
  [/upright row/, split("deltoids trapezius", "biceps")],
  [/shrug/, split("trapezius", "forearm")],
  [/lateral raise|front raise/, split("deltoids")],
  [/shoulder press|overhead press|military|arnold/, split("deltoids", "triceps trapezius")],
  [/incline/, split("chest", "deltoids triceps")],
  [/pec|butterfly|chest fly|cable fly|\bflye?s?\b/, split("chest", "deltoids")],
  [/chest press|bench press|floor press|push.?up/, split("chest", "triceps deltoids")],
  [/pulldown|pull.?up|chin.?up|pull.?over/, split("upper-back", "biceps forearm")],
  [/\bdips?\b/, split("chest triceps", "deltoids")],
  [/\brows?\b/, split("upper-back", "biceps trapezius")],
  [/triceps?|push.?down|kickback|skull/, split("triceps")],
  [/wrist/, split("forearm")],
  [/reverse curl/, split("forearm biceps")],
  [/hammer/, split("biceps forearm")],
  [/curl/, split("biceps", "forearm")],
];
const byGroup: Record<string, MuscleSplit> = {
  อก: split("chest"),
  หลัง: split("upper-back"),
  แกนกลาง: split("abs"),
  ไหล่: split("deltoids"),
};
/** The owner's own choice first, then the exercise name. An unclear leg or arm machine stays unknown. */
export function musclesFor(machine: Pick<Machine, "name" | "group" | "muscles"> | undefined): MuscleSplit {
  if (!machine) return none;
  if (machine.muscles && (machine.muscles.primary.length || machine.muscles.secondary.length))
    return machine.muscles as MuscleSplit;
  const name = machine.name.normalize("NFKC").toLowerCase();
  return rules.find(([pattern]) => pattern.test(name))?.[1] ?? byGroup[machine.group] ?? none;
}
export const muscleText = (muscles: Muscle[]) => muscles.map((muscle) => muscleLabels[muscle]).join(" · ");
