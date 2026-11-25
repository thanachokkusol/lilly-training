export type Kind =
  | "machine"
  | "session"
  | "cardio"
  | "body"
  | "photo"
  | "archive"
  | "settings"
  | "routine";
export interface Entry {
  id: string;
  kind: Kind;
  data: any;
  updatedAt: string;
  version: number;
  dirty: boolean;
  deleted?: boolean;
  conflict?: { data: any; version: number; deleted: boolean };
}
export interface Machine {
  exerciseId?: string;
  aliases?: string[];
  label?: string;
  name: string;
  thai: string;
  gym: string;
  group: string;
  setup: string;
  cues: string;
  historicalResult?: string;
  loadMode: "per-side" | "total" | "assistance" | "bodyweight";
  photoId?: string;
  referencePhotoId?: string;
  archived?: boolean;
  /** Set only when someone corrects the muscles worked out from the name. */
  muscles?: { primary: string[]; secondary: string[] };
}
export interface SetLog {
  type?: "drop" | "failure";
  /** Effort from 1 to 10, recorded only when the lifter wants it. */
  rpe?: number;
  holdSeconds?: number;
  /** Present on numeric sets stored in total kilograms. */
  enteredAs?: "total" | "perSide";
  id: string;
  load: number | null;
  loadText?: string;
  reps: number | null;
  warmup: boolean;
  done: boolean;
}
/** What a program asks for. Shown as a guide; never counted as done. */
export interface ExerciseTarget {
  sets: number;
  reps: number;
  note?: string;
  /** Seconds of rest after each set. */
  rest?: number;
}
export interface ExerciseLog {
  /** Exercises with the same number are done back to back. */
  superset?: number;
  restSeconds?: number;
  target?: ExerciseTarget;
  originalName?: string;
  reportedOnly?: boolean;
  machineId: string;
  sets: SetLog[];
  note: string;
  setup: string;
  loadMode: Machine["loadMode"];
}
export interface Session {
  startedAt?: string;
  endedAt?: string;
  gym?: string;
  date: string;
  title: string;
  status: "draft" | "completed" | "historical";
  exercises: ExerciseLog[];
  note: string;
  summary?: string;
  source?: string;
}
export interface Cardio {
  date: string;
  week: string;
  activity: string;
  seconds: number;
  distance: number | null;
  speed: number | null;
  incline: number | null;
  kcal: number | null;
  status: "confirmed" | "review";
  walkGoal: boolean;
  photoId?: string;
  note: string;
  source?: string;
  sourceId?: string;
}
export interface Body {
  date: string;
  weight: number | null;
  waist: number | null;
  fat: number | null;
  smm: number | null;
  reportUrl?: string;
  note: string;
  photoId?: string;
}
export type LoadMode = Machine["loadMode"];
