import type { Muscle } from "./muscles";
import { catalogIdOf, categoryLabel, legacyGroup } from "./muscles";
import type { Entry, LoadMode, Machine, RecordMode } from "./types";

export type CatalogItem = {
  id: string; en: string; th: string; equipment: string; detail?: string; primary: Muscle; secondary: Muscle[];
  aliases?: string[];
  record: "weight_reps" | "reps" | "time" | "added" | "assisted" | "distance" | "distance_time";
  steps: string[]; caution?: string; note?: string; images?: string[]; archived?: boolean;
};
export const equipmentLabels: Record<string, string> = {
  none: "ตัวเปล่า", barbell: "บาร์เบล", dumbbell: "ดัมเบล", kettlebell: "เคตเทิลเบล", machine: "เครื่อง / เคเบิล",
  plate: "แผ่นน้ำหนัก", resistance_band: "ยางยืด", suspension: "สายแขวน", other: "อื่นๆ",
};
export const recordLabels: Record<CatalogItem["record"], string> = {
  weight_reps: "น้ำหนัก + ครั้ง", reps: "ครั้ง", time: "เวลา", added: "น้ำหนักตัว + น้ำหนักเพิ่ม",
  assisted: "น้ำหนักตัว − แรงช่วย", distance: "น้ำหนัก + ระยะ", distance_time: "ระยะ + เวลา",
};
let loading: Promise<CatalogItem[]> | undefined;
/** The whole library is a separate download, kept for offline use with the rest of the app. */
export function loadCatalog() {
  loading ??= import("./catalogData.json").then((file) => file.default as CatalogItem[])
    .catch((error) => { loading = undefined; throw error; });
  return loading;
}
/** Exercises that belong to no gym yet. */
export const noGym = "ไม่ระบุยิม";
const oneLoad = /single|one arm|concentration|goblet|pullover|extension|side bend|cross body|pinwheel|snatch|sumo|thrust|frog|waiter|kickback|hex|squeeze|^dumbbell row|renegade|suitcase/i;
export function loadModeOf(item: CatalogItem): LoadMode {
  if (item.record === "assisted") return "assistance";
  if (item.record === "weight_reps" || item.record === "distance")
    return item.equipment === "dumbbell" && !oneLoad.test(item.en) ? "per-side" : "total";
  return "bodyweight";
}
export const recordMode = (item: CatalogItem): RecordMode | undefined =>
  item.record === "time" || item.record === "added" || item.record === "distance" || item.record === "distance_time" ? item.record : undefined;
export const catalogMachineId = (id: string, gym: string) => gym === noGym ? `hevy-${id}` : `hevy-${id}@${gym}`;
/** A new machine of ours for a universal exercise; the how-to itself stays in the library. */
export function machineFromCatalog(item: CatalogItem, gym: string): Machine {
  return {
    name: item.en, thai: item.th, gym, group: legacyGroup(item.primary), category: item.primary, catalogId: item.id,
    trains: { primary: [item.primary], secondary: item.secondary }, setup: "", cues: "", loadMode: loadModeOf(item),
    ...(recordMode(item) && { record: recordMode(item) }),
  };
}
export const machinesOf = (entries: Entry[], catalogId: string) => entries.filter((e) =>
  e.kind === "machine" && !e.deleted && !e.data.archived && catalogIdOf(e.data) === catalogId);
export function matchesExercise(query: string, ...names: (string | undefined)[]) {
  const text = names.join(" ").normalize("NFKC").toLowerCase();
  return query.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.includes(word));
}
export function searchCatalog(items: CatalogItem[], query: string, muscle = "", equipment = "") {
  return items.filter((item) => !item.archived && (!muscle || item.primary === muscle) && (!equipment || item.equipment === equipment) &&
    matchesExercise(query, item.th, item.en, categoryLabel(item.primary), ...(item.aliases ?? [])));
}
