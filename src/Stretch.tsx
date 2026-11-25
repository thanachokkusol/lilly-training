import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRememberedView } from "./App";
import { planFor, planLimits, planText, savePlan, type StretchPlan } from "./stretchPlan";
import { stretchMoves as moves, stretchTiming } from "./stretchTraining";

type Phase = { move: number; side: string; rep: number; label: string; seconds: number };
type Plans = Record<string, StretchPlan>;
function phasesFor(indices: number[], plans: Plans, manual?: boolean) {
  const phases: Phase[] = [];
  for (const [index, move] of indices.entries()) {
    const { hold, reps, rest } = plans[moves[move].id] ?? stretchTiming(moves[move].id);
    const sides = stretchTiming(moves[move].id).both ? ["สองข้างพร้อมกัน"] : ["ขวา", "ซ้าย"];
    for (const side of sides) {
      if (side === "ซ้าย" && !manual) phases.push({ move, side, rep: 1, label: "เปลี่ยนข้าง", seconds: 10 });
      for (let rep = 1; rep <= reps; rep++) {
        phases.push({ move, side, rep, label: "ยืด", seconds: hold });
        if (rep < reps && rest && !manual) phases.push({ move, side, rep, label: "พัก", seconds: rest });
      }
    }
    if (index < indices.length - 1 && !manual)
      phases.push({ move: indices[index + 1], side: "", rep: 1, label: "เปลี่ยนท่า", seconds: 15 });
  }
  return phases;
}
/** `step` is set only when the person presses for each repetition; `started` is then that repetition's start, or 0 while waiting. */
type Timer = { indices: number[]; started: number; pausedAt?: number; skipped: number[]; plans?: Plans; step?: number };
function readTimer(stored: string | null): Timer | null {
  try {
    const timer = JSON.parse(stored ?? "null") as Timer | null;
    return timer && Array.isArray(timer.indices) && timer.indices.length && Array.isArray(timer.skipped) &&
      timer.indices.every((index) => Number.isInteger(index) && index >= 0 && index < moves.length) &&
      (timer.step === undefined || (Number.isInteger(timer.step) && timer.step >= 0)) &&
      Number.isFinite(timer.started) && (timer.pausedAt === undefined || Number.isFinite(timer.pausedAt)) ? timer : null;
  } catch {
    return null;
  }
}
export type StretchResult = { reps: number; hold: number };

function Stepper({ name, label: caption, value, step, field, change }: {
  name: string; label: string; value: number; step: number; field: keyof StretchPlan; change: (value: number) => void;
}) {
  const [min, max] = planLimits[field];
  const label = `${name} ${caption}`;
  // Half-typed numbers stay in the box; only a usable value changes the plan.
  const [text, setText] = useState<string | null>(null);
  const set = (next: number) => {
    setText(null);
    change(Math.min(max, Math.max(min, Math.round(next))));
  };
  return (
    <div className="stepper">
      <span>{caption}</span>
      <div>
        <button type="button" aria-label={`ลด ${label}`} disabled={value <= min} onClick={() => set(value - step)}>−</button>
        <input type="number" inputMode="numeric" aria-label={label} min={min} max={max} value={text ?? value}
          onChange={(e) => {
            const next = Number(e.target.value);
            setText(e.target.value);
            if (e.target.value !== "" && Number.isInteger(next) && next >= min && next <= max) change(next);
          }}
          onBlur={() => setText(null)} />
        <button type="button" aria-label={`เพิ่ม ${label}`} disabled={value >= max} onClick={() => set(value + step)}>+</button>
      </div>
    </div>
  );
}

/** How to do one stretch, how long, and recording it without any timer. */
function MovePlan({ id, plan, change, log, photo }: {
  id: string; plan: StretchPlan; change: (plan: StretchPlan) => void; log: (result: StretchResult) => void; photo?: ReactNode;
}) {
  const move = moves.find((item) => item.id === id)!;
  const sides = stretchTiming(id).both ? 1 : 2;
  const [done, setDone] = useState<number | null>(null);
  const total = done ?? plan.reps * sides;
  const prefix = move.thai;
  return (
    <article className="stretch-plan">
      {photo}
      <h3>{move.thai}</h3>
      <p className="preserve">{move.cues}</p>
      <p className="stretch-plan-text">{planText(id, plan)}{plan.rest > 0 && ` · พัก ${plan.rest} วิ`}</p>
      <div className="stepper-row">
        <Stepper name={prefix} label="ค้างกี่วินาที" field="hold" step={5} value={plan.hold} change={(hold) => change({ ...plan, hold })} />
        <Stepper name={prefix} label={`กี่ครั้ง${sides === 2 ? "ต่อข้าง" : ""}`} field="reps" step={1} value={plan.reps} change={(reps) => change({ ...plan, reps })} />
        <Stepper name={prefix} label="พักกี่วินาที" field="rest" step={5} value={plan.rest} change={(rest) => change({ ...plan, rest })} />
      </div>
      <details>
        <summary>บันทึกเองไม่จับเวลา</summary>
        <div className="stretch-log">
          <label>ทำไปทั้งหมดกี่ครั้ง{sides === 2 && " (รวมสองข้าง)"}
            <input type="number" inputMode="numeric" min={1} max={100} aria-label={`${prefix} ทำไปทั้งหมดกี่ครั้ง`} value={total}
              onChange={(e) => setDone(e.target.value === "" ? 0 : Math.min(100, Math.max(0, Math.round(Number(e.target.value)))))} />
          </label>
          <button type="button" className="secondary" disabled={!total} onClick={() => log({ reps: total, hold: plan.hold })}>
            บันทึกค้าง {plan.hold} วิ × {total} ครั้ง
          </button>
        </div>
      </details>
    </article>
  );
}

export default function Stretch({ ids, sessionId, onSave, onLog, back, photo }: {
  ids: string[];
  sessionId: string;
  onSave: (results: Map<string, StretchResult>) => void;
  onLog: (id: string, result: StretchResult) => void;
  back: () => void;
  photo: (id: string) => ReactNode;
}) {
  const [stored, setStored] = useRememberedView(`stretch-timer:${sessionId}:${ids.join(",")}`);
  const [plans, setPlans] = useState<Plans>(() => Object.fromEntries(ids.map((id) => [id, planFor(id)])));
  const [now, setNow] = useState(Date.now);
  const timer = readTimer(stored);
  const manual = timer?.step !== undefined;
  const phases = timer ? phasesFor(timer.indices, timer.plans ?? {}, manual) : [];
  const elapsed = timer ? (Math.max(0, (timer.pausedAt ?? now) - timer.started) / 1000) : 0;
  let offset = 0;
  const running = manual ? undefined : phases.find((phase) => {
    if (elapsed < offset + phase.seconds) return true;
    offset += phase.seconds;
    return false;
  });
  const current = manual ? phases[timer!.step!] : running;
  const waiting = manual && !timer!.started;
  const total = phases.reduce((sum, phase) => sum + phase.seconds, 0);
  const remaining = !current ? 0 : manual
    ? waiting ? current.seconds : Math.max(0, Math.ceil(current.seconds - (now - timer!.started) / 1000))
    : Math.ceil(offset + current.seconds - elapsed);
  const ticking = Boolean(current && timer && (manual ? timer.started : !timer.pausedAt));
  const saveTimer = (value: Timer | null) => {
    setNow(Date.now());
    setStored(value && JSON.stringify(value));
  };
  useEffect(() => {
    if (!ticking) return;
    const interval = window.setInterval(() => setNow(Date.now()), 200);
    let active = true;
    let lock: WakeLockSentinel | undefined;
    const keepAwake = async () => {
      if (document.visibilityState !== "visible" || lock && !lock.released) return;
      try {
        const acquired = await navigator.wakeLock?.request("screen");
        if (active) lock = acquired;
        else await acquired?.release();
      } catch { /* The timestamp still advances without a wake lock. */ }
    };
    const refresh = () => { setNow(Date.now()); void keepAwake(); };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      void lock?.release();
    };
  }, [ticking]);
  // A hold that ran out waits for the next press instead of starting the next one.
  const holdOver = manual && !waiting && !!current && remaining === 0;
  useEffect(() => {
    if (holdOver && timer) saveTimer({ ...timer, step: timer.step! + 1, started: 0 });
  }, [holdOver]);
  const seek = (seconds: number, skipped: number[]) => {
    if (!timer) return;
    const time = Date.now();
    saveTimer({ ...timer, started: time - seconds * 1000, pausedAt: timer.pausedAt ? time : undefined, skipped });
  };
  const changePlan = (id: string, plan: StretchPlan) => {
    setPlans((all) => ({ ...all, [id]: plan }));
    savePlan(id, plan);
  };
  const begin = (stepByStep: boolean, button: HTMLElement) => {
    button.closest(".modal")?.scrollTo?.(0, 0);
    saveTimer({
    indices: ids.map((id) => moves.findIndex((move) => move.id === id)),
    started: stepByStep ? 0 : Date.now(), skipped: [], plans, ...(stepByStep && { step: 0 }),
    });
  };
  const currentIndex = current ? phases.indexOf(current) : phases.length;
  const results = new Map(ids.map((id) => [id, 0]));
  phases.slice(0, currentIndex).forEach((phase, index) => {
    if (phase.label !== "ยืด" || timer?.skipped.includes(index)) return;
    const id = moves[phase.move].id;
    results.set(id, (results.get(id) ?? 0) + 1);
  });
  const planOf = (id: string) => timer?.plans?.[id] ?? stretchTiming(id);
  if (!timer) return (
    <>
      <button className="text-button" onClick={back}>กลับไปที่รายการฝึก</button>
      {ids.map((id) => (
        <MovePlan key={id} id={id} plan={plans[id]} change={(plan) => changePlan(id, plan)} log={(result) => onLog(id, result)} photo={photo(id)} />
      ))}
      <div className="stretch-start">
        <button className="primary" onClick={(e) => begin(false, e.currentTarget)}>{ids.length > 1 ? "เริ่มจับเวลาทั้งชุด" : "เริ่มจับเวลาท่านี้"}</button>
        <button className="secondary" onClick={(e) => begin(true, e.currentTarget)}>กดเองทีละครั้ง</button>
      </div>
    </>
  );
  return (
    <>
      <button className="text-button" onClick={back}>กลับไปที่รายการฝึก</button>
      {current ? <>
        {photo(moves[current.move].id)}
        <div className={`notice stretch-phase ${current.label === "ยืด" && !waiting ? "active" : ""}`}>
          <h3>{waiting ? `พร้อมแล้วกดเริ่ม · ${remaining} วิ` : `${current.label} · ${remaining} วิ`}</h3>
          <p>{moves[current.move].thai} {current.side && `· ${current.side}`}{current.label !== "เปลี่ยนท่า" && ` · ครั้ง ${current.rep}/${planOf(moves[current.move].id).reps}`}</p>
          <p className="preserve">{moves[current.move].cues}</p>
        </div>
        {manual ? (
          <>
            <progress max={phases.length} value={timer.step} aria-label="ความคืบหน้าการยืด" />
            <div className="upload-row">
              <button className="secondary" disabled={!timer.step} onClick={() => saveTimer({ ...timer, step: timer.step! - 1, started: 0,
                skipped: timer.skipped.filter((index) => index < timer.step! - 1) })}>ย้อน</button>
              {waiting
                ? <button className="primary" onClick={() => saveTimer({ ...timer, started: Date.now() })}>เริ่มค้าง</button>
                : <button className="primary" onClick={() => saveTimer({ ...timer, started: 0 })}>หยุด</button>}
              <button className="secondary" onClick={() => saveTimer({ ...timer, step: timer.step! + 1, started: 0 })}>นับว่าทำแล้ว</button>
              <button className="secondary" onClick={() => saveTimer({ ...timer, step: timer.step! + 1, started: 0, skipped: [...timer.skipped, timer.step!] })}>ข้ามครั้งนี้</button>
            </div>
          </>
        ) : (
          <>
            <progress max={total} value={Math.min(elapsed, total)} aria-label="ความคืบหน้าการยืด" />
            <div className="upload-row">
              <button className="secondary" onClick={() => seek(Math.max(0, offset - (phases[currentIndex - 1]?.seconds ?? 0)),
                timer.skipped.filter((index) => index < currentIndex - 1))}>ย้อนช่วง</button>
              <button className="primary" onClick={() => {
                const time = Date.now();
                saveTimer(timer.pausedAt ? { ...timer, started: timer.started + time - timer.pausedAt, pausedAt: undefined } :
                  { ...timer, pausedAt: time });
              }}>{timer.pausedAt ? "ทำต่อ" : "พักตัวจับเวลา"}</button>
              <button className="secondary" onClick={() => seek(offset + current.seconds, [...timer.skipped, currentIndex])}>ข้ามช่วง</button>
            </div>
          </>
        )}
      </> : <h3>ถึงท้ายโปรแกรมแล้ว</h3>}
      <ul>{ids.map((id) => <li key={id}>{moves.find((move) => move.id === id)?.thai} · ทำแล้ว {results.get(id)} ครั้ง</li>)}</ul>
      <button className="primary" disabled={![...results.values()].some(Boolean)} onClick={() => {
        onSave(new Map([...results].filter(([, reps]) => reps).map(([id, reps]) => [id, { reps, hold: planOf(id).hold }])));
        saveTimer(null);
      }}>บันทึกผลที่ทำแล้ว</button>
      <button className="text-button" onClick={() => saveTimer(null)}>ล้างตัวจับเวลา</button>
    </>
  );
}
