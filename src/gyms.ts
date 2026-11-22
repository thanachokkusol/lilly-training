import type { Entry } from "./types";

export type Gym = { id: string; name: string; shortCode: string; archived: boolean };
export const gymCatalogId = "settings-gym-catalog";

const defaults: Gym[] = [
  { id: "WE Fitness", name: "WE Fitness", shortCode: "WE", archived: false },
  { id: "Jett", name: "Jett", shortCode: "J", archived: false },
  { id: "M Fitness", name: "M Fitness", shortCode: "M", archived: false },
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
  return [...gyms.values()];
}

export function gymName(entries: Entry[], id: string) {
  return gymsFor(entries).find((gym) => gym.id === id)?.name ?? id;
}
