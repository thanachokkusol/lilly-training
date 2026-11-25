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
