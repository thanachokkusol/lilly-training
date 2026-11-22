import { exerciseKey } from "./core";
import type { Entry, ExerciseLog, Machine, Session } from "./types";
import { validateEntry } from "./validation";

type Change = Pick<Entry, "id" | "kind" | "data">;
export type MachineMove = {
  from: string;
  to: string;
  machine: Machine;
  originalName?: string;
  note?: string;
  setup?: string;
};

/**
 * Prepare a migration against a snapshot. The caller supplies reviewed machine
 * mappings for each session; a date or similarly named exercise is not enough
 * to identify where a set was performed.
 */
export function planSessionMove(
  entries: Entry[],
  sessionId: string,
  gym: string,
  moves: MachineMove[],
): Change[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const record = byId.get(sessionId);
  if (!record || record.kind !== "session" || record.deleted || record.conflict) {
    throw Error("ไม่พบครั้งฝึกที่พร้อมย้าย");
  }
  const session = record.data as Session;
  const bySource = new Map(moves.map((move) => [move.from, move]));
  if (
    moves.length !== bySource.size ||
    session.exercises.length !== moves.length ||
    !session.exercises.every((exercise) => bySource.has(exercise.machineId))
  ) {
    throw Error("ต้องยืนยันเครื่องของทุกท่าในครั้งฝึกนี้ก่อนย้าย");
  }
  const changes = new Map<string, Change>();
  const exercises = session.exercises.map((exercise): ExerciseLog => {
    const move = bySource.get(exercise.machineId)!;
    const source = byId.get(move.from);
    const target = byId.get(move.to);
    if (target && (target.kind !== "machine" || target.deleted || target.conflict ||
      target.data.gym !== gym || exerciseKey(target.data) !== exerciseKey(move.machine))) {
      throw Error("เครื่องปลายทางไม่ตรงกับท่าและยิมที่ยืนยัน");
    }
    if (!target) changes.set(move.to, {
      id: move.to,
      kind: "machine",
      data: { ...move.machine, gym },
    });
    const sets = exercise.sets.map((set) => {
      const match = set.loadText?.trim().match(/^(WE|J|M)\s*รวม\s*(\d+(?:\.\d+)?)$/i);
      if (!match) return { ...set };
      const gyms = { WE: "WE Fitness", J: "Jett", M: "M Fitness" };
      if (gyms[match[1].toUpperCase() as keyof typeof gyms] !== gym ||
          (set.load !== null && set.load !== Number(match[2]))) {
        throw Error("ป้ายน้ำหนักเดิมขัดกับยิมหรือน้ำหนักที่บันทึกไว้");
      }
      return { ...set, load: Number(match[2]), loadText: undefined, enteredAs: "total" as const };
    });
    const converted = exercise.sets.some((set, i) => set.loadText && !sets[i].loadText);
    if (converted && exercise.loadMode !== "total") {
      if (sets.some((set, i) => set.load !== null && (!exercise.sets[i].loadText || sets[i].loadText))) {
        throw Error("พบเซตที่ใช้หน่วยน้ำหนักต่างกัน ต้องตรวจแยกก่อนย้าย");
      }
    }
    return {
      ...exercise,
      machineId: move.to,
      originalName: exercise.originalName ?? move.originalName ?? source?.data.name,
      setup: move.setup ?? exercise.setup,
      note: move.note && !exercise.note?.includes(move.note)
        ? [exercise.note, move.note].filter(Boolean).join(" · ")
        : exercise.note,
      loadMode: converted ? "total" : exercise.loadMode,
      sets,
    };
  });
  changes.set(sessionId, { id: sessionId, kind: "session", data: { ...session, gym, exercises } });
  for (const change of changes.values()) validateEntry(change);
  return [...changes.values()];
}
