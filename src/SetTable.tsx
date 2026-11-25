import { useState } from "react";
import { Check } from "lucide-react";
import { loadLabel, secondsText, totalLoad } from "./core";
import type { ExerciseLog, SetLog } from "./types";

const typeOf = (set: SetLog) => set.warmup ? "warmup" : set.type ?? "normal";
const types = [
  ["normal", "ปกติ"], ["warmup", "วอร์ม"], ["drop", "ดรอป"], ["failure", "จนหมดแรง"],
] as const;
const badges: Record<string, string> = { warmup: "W", drop: "D", failure: "F" };

/** One row per set with the matching set from last time beside it. `prefix` keeps labels unique when several tables are on screen. */
export default function SetTable({ x, previous, prefix = "", unit: inputMode, showRpe, textLoad, patch, remove, toggle }: {
  x: ExerciseLog;
  previous?: ExerciseLog;
  prefix?: string;
  unit: "total" | "perSide";
  showRpe: boolean;
  textLoad?: boolean;
  patch: (index: number, set: Partial<SetLog>) => void;
  remove: (index: number) => void;
  toggle: (index: number) => void;
}) {
  const [menu, setMenu] = useState<string | null>(null);
  const configurable = x.loadMode === "total" || x.loadMode === "per-side";
  const divisor = configurable && inputMode === "perSide" ? 2 : 1;
  const unit = configurable ? (divisor === 2 ? "กก./ข้าง" : "กก.") : loadLabel(x.loadMode);
  const before = (previous?.sets ?? []).filter((set) => set.done);
  const matching = (index: number) => {
    const warmup = x.sets[index].warmup;
    const place = x.sets.slice(0, index).filter((set) => set.warmup === warmup).length;
    return before.filter((set) => !!set.warmup === warmup)[place];
  };
  const byTime = x.record === "time" || x.record === "distance_time";
  const firstHead = textLoad ? "น้ำหนัก (ข้อความ)" : x.record === "time" ? "" : x.record === "distance_time" ? "เมตร" : x.record === "added" ? "กก. เพิ่ม" : unit;
  const secondHead = byTime ? "วินาที" : x.record === "distance" ? "เมตร" : "ครั้ง";
  const previousText = (set: SetLog) => {
    if (set.timed || set.meters != null) return [set.meters != null && `${set.meters} ม.`, set.timed && secondsText(set.holdSeconds ?? 0)].filter(Boolean).join(" ");
    if (x.loadMode === "bodyweight" && set.load) return `+${set.load}×${set.reps ?? "–"}`;
    if (x.loadMode === "bodyweight") return `${set.reps ?? "–"} ครั้ง`;
    const load = set.load === null ? set.loadText?.trim() : totalLoad(set, previous!.loadMode)! / divisor;
    return `${load ?? "–"}×${set.reps ?? "–"}`;
  };
  const copy = (index: number, set: SetLog) => patch(index, {
    reps: set.reps,
    ...(set.timed && { timed: true, holdSeconds: set.holdSeconds }),
    ...(set.meters != null && { meters: set.meters }),
    ...(x.record === "added" && { load: set.load }),
    ...(x.loadMode !== "bodyweight" && set.load !== null && {
      load: totalLoad(set, previous!.loadMode),
      enteredAs: configurable ? inputMode : undefined,
    }),
  });
  return (
    <div className={`set-table${showRpe ? " with-rpe" : ""}`}>
      <div className="set-head">
        <span>เซต</span>
        <span>ครั้งก่อน</span>
        <span>{firstHead}</span>
        <span>{secondHead}</span>
        {showRpe && <span>RPE</span>}
        <span>เสร็จ</span>
      </div>
      {x.sets.map((a, j) => {
        const label = `${prefix}เซต ${j + 1}`;
        const type = typeOf(a);
        const last = matching(j);
        return (
          <div key={a.id}>
            <div className={`set-row ${a.done ? "done" : ""}`}>
              <button type="button" className={`set-no ${type}`} aria-expanded={menu === a.id}
                aria-label={`${label} ชนิด ${types.find(([key]) => key === type)![1]}`}
                onClick={() => setMenu(menu === a.id ? null : a.id)}>
                {x.reportedOnly ? "ผล" : badges[type] ?? x.sets.slice(0, j + 1).filter((set) => !set.warmup).length}
              </button>
              {last ? (
                <button type="button" className="set-previous" disabled={a.done} aria-label={`${label} ใช้ค่าครั้งก่อน ${previousText(last)}`}
                  onClick={() => copy(j, last)}>{previousText(last)}</button>
              ) : <span className="set-previous">–</span>}
              {textLoad ? (
                <input aria-label={`${label} น้ำหนักแบบข้อความ`} value={a.loadText ?? ""} placeholder="เช่น 13.5 กก. + 10 ที่หมุน"
                  onChange={(e) => patch(j, { loadText: e.target.value })} />
              ) : x.record === "time" ? <span /> : x.record === "distance_time" ? (
                <input aria-label={`${label} ระยะ (เมตร)`} type="number" inputMode="decimal" min="0" step="1" placeholder="–" value={a.meters ?? ""}
                  onChange={(e) => patch(j, { meters: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} />
              ) : (
                <input aria-label={`${label} น้ำหนัก`} type="number" inputMode="decimal" min="0" step="0.1"
                  placeholder={x.record === "added" ? "+0" : x.loadMode === "bodyweight" ? "ตัว" : "–"}
                  value={a.load === null ? "" : totalLoad(a, x.loadMode)! / divisor}
                  disabled={x.loadMode === "bodyweight" && x.record !== "added"}
                  onChange={(e) => patch(j, {
                    load: e.target.value === "" ? null : Number(e.target.value) * divisor,
                    enteredAs: configurable ? inputMode : undefined,
                  })} />
              )}
              {byTime ? (
                <input aria-label={`${label} เวลา (วินาที)`} type="number" inputMode="numeric" min="1" step="1" placeholder="–" value={a.holdSeconds ?? ""}
                  onChange={(e) => {
                    const seconds = Math.round(Number(e.target.value));
                    patch(j, seconds > 0 ? { holdSeconds: seconds, timed: true, reps: 1 } : { holdSeconds: undefined, timed: undefined, reps: null });
                  }} />
              ) : x.record === "distance" ? (
                <input aria-label={`${label} ระยะ (เมตร)`} type="number" inputMode="decimal" min="0" step="1" placeholder="–" value={a.meters ?? ""}
                  onChange={(e) => patch(j, Number(e.target.value) > 0 ? { meters: Number(e.target.value), reps: 1 } : { meters: undefined, reps: null })} />
              ) : (
                <input aria-label={`${label} จำนวนครั้ง`} type="number" inputMode="numeric" min="1" step="1" placeholder="–"
                  value={a.reps ?? ""}
                  onChange={(e) => patch(j, { reps: e.target.value === "" ? null : Number(e.target.value) })} />
              )}
              {showRpe && (
                <select aria-label={`${label} RPE`} value={a.rpe ?? ""}
                  onChange={(e) => patch(j, { rpe: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">–</option>
                  {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((value) => <option key={value}>{value}</option>)}
                </select>
              )}
              <button type="button" className={`set-check ${a.done ? "checked" : ""}`} aria-label={`ยืนยัน${label}`}
                aria-pressed={a.done} onClick={() => toggle(j)}>
                <Check size={18} />
              </button>
            </div>
            {menu === a.id && (
              <div className="set-menu" role="group" aria-label={`ตัวเลือก ${label}`}>
                {types.map(([key, text]) => (
                  <button type="button" key={key} aria-pressed={type === key} onClick={() => {
                    patch(j, { warmup: key === "warmup", type: key === "drop" || key === "failure" ? key : undefined });
                    setMenu(null);
                  }}>{text}</button>
                ))}
                <button type="button" className="danger-text" aria-label={`ลบ${label}`} onClick={() => {
                  setMenu(null);
                  remove(j);
                }}>ลบเซต</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
