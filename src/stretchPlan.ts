import { stretchTiming } from "./stretchTraining";

export type StretchPlan = { hold: number; reps: number; rest: number };
export const planLimits = { hold: [5, 300], reps: [1, 20], rest: [0, 120] } as const;
const key = (id: string) => `lilly-stretch-plan:${id}`;
const clamp = (field: keyof StretchPlan, value: unknown, fallback: number) => {
  const [min, max] = planLimits[field];
  return typeof value === "number" && Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
};
/** Seconds, repetitions per side and rest: what this person last chose on this device, otherwise the suggestion. */
export function planFor(id: string): StretchPlan {
  const { hold, reps, rest } = stretchTiming(id);
  try {
    const saved = JSON.parse(localStorage.getItem(key(id)) ?? "null");
    if (saved && typeof saved === "object")
      return { hold: clamp("hold", saved.hold, hold), reps: clamp("reps", saved.reps, reps), rest: clamp("rest", saved.rest, rest) };
  } catch { /* Use the suggestion when storage is unavailable. */ }
  return { hold, reps, rest };
}
export function savePlan(id: string, plan: StretchPlan) {
  try {
    const { hold, reps, rest } = stretchTiming(id);
    if (plan.hold === hold && plan.reps === reps && plan.rest === rest) localStorage.removeItem(key(id));
    else localStorage.setItem(key(id), JSON.stringify(plan));
  } catch { /* The choice still applies to this screen. */ }
}
export const planText = (id: string, plan = planFor(id)) =>
  `ค้าง ${plan.hold} วิ × ${plan.reps} ครั้ง${stretchTiming(id).both ? "" : "ต่อข้าง"}`;
