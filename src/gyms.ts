import { noGym } from "./catalog";
import type { Entry } from "./types";

export type Gym = { id: string; name: string; shortCode: string; archived: boolean; removed?: boolean };
export const gymCatalogId = "settings-gym-catalog";

const defaults: Gym[] = [
  { id: "WE Fitness", name: "WE Fitness", shortCode: "WE", archived: false },
  { id: "Jett", name: "Jett", shortCode: "J", archived: false },
  { id: "M Fitness", name: "M Fitness", shortCode: "M", archived: false },
  { id: "ที่บ้าน", name: "ที่บ้าน", shortCode: "บ้าน", archived: false },
];

export function gymsFor(entries: Entry[]): Gym[] {
  const saved = entries.find((e) => e.id === gymCatalogId && e.kind === "settings" && !e.deleted)?.data.gyms as Gym[] | undefined;
  const gyms = new Map(defaults.map((gym) => [gym.id, gym]));
  for (const gym of saved ?? []) gyms.set(gym.id, gym);
  for (const e of entries) {
    const id = e.kind === "machine" && e.data.gym;
    if (typeof id === "string" && id && !gyms.has(id))
      gyms.set(id, { id, name: id, shortCode: "", archived: false });
  }
  // Exercises without a gym come last and cannot be renamed or removed.
  gyms.delete(noGym);
  return [...[...gyms.values()].filter((gym) => !gym.removed), { id: noGym, name: noGym, shortCode: "", archived: false }];
}
/** A gym can be removed once nothing in use or in any workout belongs to it. */
export function gymInUse(entries: Entry[], id: string) {
  const machines = new Map(entries.filter((e) => e.kind === "machine" && e.data.gym === id).map((e) => [e.id, e]));
  return [...machines.values()].some((e) => !e.deleted && !e.data.archived) || entries.some((e) =>
    e.kind === "session" && !e.deleted && (e.data.gym === id ||
      e.data.exercises.some((x: { machineId: string }) => machines.has(x.machineId))));
}

export function gymName(entries: Entry[], id: string) {
  return gymsFor(entries).find((gym) => gym.id === id)?.name ?? id;
}
