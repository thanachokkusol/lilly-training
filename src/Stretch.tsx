import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRememberedView } from "./App";
import { stretchMoves as moves, stretchTiming } from "./stretchTraining";

type Phase = { move: number; side: string; rep: number; label: string; seconds: number };
function phasesFor(indices: number[]) {
  const phases: Phase[] = [];
  for (const [index, move] of indices.entries()) {
    const { both, hold, reps, rest } = stretchTiming(moves[move].id);
    const sides = both ? ["สองข้างพร้อมกัน"] : ["ขวา", "ซ้าย"];
    for (const side of sides) {
      if (side === "ซ้าย") phases.push({ move, side, rep: 1, label: "เปลี่ยนข้าง", seconds: 10 });
      for (let rep = 1; rep <= reps; rep++) {
        phases.push({ move, side, rep, label: "ยืด", seconds: hold });
        if (rep < reps) phases.push({ move, side, rep, label: "พัก", seconds: rest });
      }
    }
    if (index < indices.length - 1)
      phases.push({ move: indices[index + 1], side: "", rep: 1, label: "เปลี่ยนท่า", seconds: 15 });
  }
  return phases;
}
type Timer = { indices: number[]; started: number; pausedAt?: number; skipped: number[] };
function readTimer(stored: string | null): Timer | null {
  try {
    const timer = JSON.parse(stored ?? "null") as Timer | null;
    return timer && Array.isArray(timer.indices) && timer.indices.length && Array.isArray(timer.skipped) &&
      timer.indices.every((index) => Number.isInteger(index) && index >= 0 && index < moves.length) &&
      Number.isFinite(timer.started) && (timer.pausedAt === undefined || Number.isFinite(timer.pausedAt)) ? timer : null;
  } catch {
    return null;
  }
}

export default function Stretch({ ids, sessionId, onSave, back, photo }: {
  ids: string[];
  sessionId: string;
  onSave: (results: Map<string, number>) => void;
  back: () => void;
  photo: (id: string) => ReactNode;
}) {
  const [stored, setStored] = useRememberedView(`stretch-timer:${sessionId}:${ids.join(",")}`);
  const [now, setNow] = useState(Date.now);
  const timer = readTimer(stored);
  const phases = timer ? phasesFor(timer.indices) : [];
  const elapsed = timer ? (Math.max(0, (timer.pausedAt ?? now) - timer.started) / 1000) : 0;
  let offset = 0;
  const current = phases.find((phase) => {
    if (elapsed < offset + phase.seconds) return true;
    offset += phase.seconds;
    return false;
  });
  const total = phases.reduce((sum, phase) => sum + phase.seconds, 0);
  const remaining = current ? Math.ceil(offset + current.seconds - elapsed) : 0;
  const running = Boolean(current && timer && !timer.pausedAt);
  useEffect(() => {
    if (!running) return;
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
  }, [running]);
  const saveTimer = (value: Timer | null) => {
    setNow(Date.now());
    setStored(value && JSON.stringify(value));
  };
  const seek = (seconds: number, skipped: number[]) => {
    if (!timer) return;
    const time = Date.now();
    saveTimer({ ...timer, started: time - seconds * 1000, pausedAt: timer.pausedAt ? time : undefined, skipped });
  };
  const currentIndex = current ? phases.indexOf(current) : phases.length;
  const results = new Map(ids.map((id) => [id, 0]));
  phases.slice(0, currentIndex).forEach((phase, index) => {
    if (phase.label !== "ยืด" || timer?.skipped.includes(index)) return;
    const id = moves[phase.move].id;
    results.set(id, (results.get(id) ?? 0) + 1);
  });
  return (
    <>
      <button className="text-button" onClick={back}>กลับไปที่รายการฝึก</button>
      {!timer ? <button className="primary" onClick={() => saveTimer({
        indices: ids.map((id) => moves.findIndex((move) => move.id === id)),
        started: Date.now(), skipped: [],
      })}>{ids.length > 1 ? "เริ่มจับเวลาทั้งชุด" : "เริ่มจับเวลาท่านี้"}</button> : (
        <>
          {current ? <>
            {ids.length > 1 && photo(moves[current.move].id)}
            <div className={`notice stretch-phase ${current.label === "ยืด" ? "active" : ""}`}>
              <h3>{current.label} · {remaining} วิ</h3>
              <p>{moves[current.move].thai} {current.side && `· ${current.side}`}{current.label !== "เปลี่ยนท่า" && ` · ครั้ง ${current.rep}/${stretchTiming(moves[current.move].id).reps}`}</p>
              <p className="preserve">{moves[current.move].cues}</p>
            </div>
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
          </> : <h3>ถึงท้ายโปรแกรมแล้ว</h3>}
          <ul>{ids.map((id) => <li key={id}>{moves.find((move) => move.id === id)?.thai} · ทำแล้ว {results.get(id)} ครั้ง</li>)}</ul>
          <button className="primary" disabled={![...results.values()].some(Boolean)} onClick={() => {
            onSave(results);
            saveTimer(null);
          }}>บันทึกผลที่ทำแล้ว</button>
          <button className="text-button" onClick={() => saveTimer(null)}>ล้างตัวจับเวลา</button>
        </>
      )}
    </>
  );
}
