import { useState } from "react";
import { Check, X } from "lucide-react";
import { loadLabel, totalLoad } from "./core";
import type { ExerciseLog, SetLog } from "./types";

// Warm-up flags from older records count as ordinary sets; the owner logs every set as a working set.
const typeOf = (set: SetLog) => set.type ?? "normal";
const types = [
  ["normal", "ปกติ"], ["drop", "ดรอป"], ["failure", "จนหมดแรง"],
] as const;
const badges: Record<string, string> = { drop: "D", failure: "F" };

/** One row per set: number, load, reps, confirm and delete. Last time's matching set shows as the faint placeholder. `prefix` keeps labels unique when several tables are on screen. */
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
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const configurable = x.loadMode === "total" || x.loadMode === "per-side";
  const divisor = configurable && inputMode === "perSide" ? 2 : 1;
  const unit = configurable ? (divisor === 2 ? "กก./ข้าง" : "กก.") : loadLabel(x.loadMode);
  const before = (previous?.sets ?? []).filter((set) => set.done);
  const matching = (index: number) => before[index];
  const byTime = x.record === "time" || x.record === "distance_time";
  const firstHead = textLoad ? "น้ำหนัก (ข้อความ)" : x.record === "time" ? "" : x.record === "distance_time" ? "เมตร" : x.record === "added" ? "กก. เพิ่ม" : unit;
  const secondHead = byTime ? "วินาที" : x.record === "distance" ? "เมตร" : "ครั้ง";
  const hint = (value: number | null | undefined) => value == null ? "–" : String(value);
  const previousLoad = (set?: SetLog) => {
    if (!set || set.load === null) return undefined;
    if (x.loadMode === "bodyweight") return x.record === "added" ? set.load : undefined;
    return totalLoad(set, previous!.loadMode)! / divisor;
  };
  return (
    <div className={`set-table${showRpe ? " with-rpe" : ""}`}>
      <div className="set-head">
        <span>เซต</span>
        <span>{firstHead}</span>
        <span>{secondHead}</span>
        {showRpe && <span>RPE</span>}
        <span>เสร็จ</span>
        <span><span className="sr-only">ลบ</span></span>
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
                {x.reportedOnly ? "ผล" : badges[type] ?? j + 1}
              </button>
              {textLoad ? (
                <input aria-label={`${label} น้ำหนักแบบข้อความ`} value={a.loadText ?? ""} placeholder="เช่น 13.5 กก. + 10 ที่หมุน"
                  onChange={(e) => patch(j, { loadText: e.target.value })} />
              ) : x.record === "time" ? <span /> : x.record === "distance_time" ? (
                <input aria-label={`${label} ระยะ (เมตร)`} type="number" inputMode="decimal" min="0" step="1" placeholder="–" value={a.meters ?? ""}
                  onChange={(e) => patch(j, { meters: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} />
              ) : (
                <input aria-label={`${label} น้ำหนัก`} type="number" inputMode="decimal" min="0" step="0.1"
                  placeholder={x.record === "added" ? `+${previousLoad(last) ?? 0}` : x.loadMode === "bodyweight" ? "ตัว" : hint(previousLoad(last))}
                  value={a.load === null ? "" : totalLoad(a, x.loadMode)! / divisor}
                  disabled={x.loadMode === "bodyweight" && x.record !== "added"}
                  onChange={(e) => patch(j, {
                    load: e.target.value === "" ? null : Number(e.target.value) * divisor,
                    enteredAs: configurable ? inputMode : undefined,
                  })} />
              )}
              {byTime ? (
                <input aria-label={`${label} เวลา (วินาที)`} type="number" inputMode="numeric" min="1" step="1" placeholder={hint(last?.holdSeconds)} value={a.holdSeconds ?? ""}
                  onChange={(e) => {
                    const seconds = Math.round(Number(e.target.value));
                    patch(j, seconds > 0 ? { holdSeconds: seconds, timed: true, reps: 1 } : { holdSeconds: undefined, timed: undefined, reps: null });
                  }} />
              ) : x.record === "distance" ? (
                <input aria-label={`${label} ระยะ (เมตร)`} type="number" inputMode="decimal" min="0" step="1" placeholder="–" value={a.meters ?? ""}
                  onChange={(e) => patch(j, Number(e.target.value) > 0 ? { meters: Number(e.target.value), reps: 1 } : { meters: undefined, reps: null })} />
              ) : (
                <input aria-label={`${label} จำนวนครั้ง`} type="number" inputMode="numeric" min="1" step="1" placeholder={hint(last?.reps)}
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
              <button type="button" className={`set-remove${confirmRemove === a.id ? " confirm" : ""}`}
                aria-label={confirmRemove === a.id ? `ยืนยันลบ${label}` : `ลบ${label}`}
                onClick={() => {
                  if (a.done && confirmRemove !== a.id) return setConfirmRemove(a.id);
                  setConfirmRemove(null);
                  setMenu(null);
                  remove(j);
                }}
                onBlur={() => setConfirmRemove((id) => id === a.id ? null : id)}>
                {confirmRemove === a.id ? "ลบ?" : <X size={16} />}
              </button>
            </div>
            {menu === a.id && (
              <div className="set-menu" role="group" aria-label={`ตัวเลือก ${label}`}>
                {types.map(([key, text]) => (
                  <button type="button" key={key} aria-pressed={type === key} onClick={() => {
                    patch(j, { warmup: false, type: key === "drop" || key === "failure" ? key : undefined });
                    setMenu(null);
                  }}>{text}</button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
