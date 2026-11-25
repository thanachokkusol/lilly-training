import type { Entry } from "./types";

const identifications = new Map([
  ["jett-extra-2", { name: "Biceps Curl", catalogId: "AF328E3D" }],
  ["jett-extra-3", { name: "Abdominal Crunch", catalogId: "EB43ADD4" }],
  ["jett-extra-7", { name: "Wide-Grip Lat Pulldown", catalogId: "473CF5B8" }],
  ["jett-extra-15", { name: "Shoulder Press", catalogId: "9237BAD1" }],
  ["jett-extra-18", { name: "Leg Extension", catalogId: "75A4F6C4" }],
]);

export const jettIdentification = (id: string) => identifications.get(id);

export const isPendingMachine = (entry: Entry) =>
  entry.kind === "machine" && identifications.has(entry.id) && !entry.data.catalogId;

export function identifiedJettMachine(entry: Entry) {
  const identification = jettIdentification(entry.id);
  if (!identification || !isPendingMachine(entry) || entry.deleted || entry.data.gym !== "Jett") return;
  return { ...entry.data, ...identification, exerciseId: entry.id };
}

/** Prefer the identified PDF machine when an older Jett card has the same name. */
export function withoutDuplicateJettCards(machines: Entry[]) {
  const confirmed = new Set(machines.filter((entry) =>
    entry.data.gym === "Jett" && !entry.data.archived && jettIdentification(entry.id) &&
    entry.data.catalogId === jettIdentification(entry.id)?.catalogId,
  ).map((entry) => entry.data.name.trim().toLowerCase()));
  return machines.filter((entry) => entry.data.gym !== "Jett" || jettIdentification(entry.id) ||
    !confirmed.has(entry.data.name.trim().toLowerCase()));
}
