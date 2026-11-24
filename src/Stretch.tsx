import { useEffect, useState } from "react";
import { Activity, ArrowUpRight } from "lucide-react";
import { Modal, useRememberedView } from "./App";
import { homeGym } from "./homeTraining";
import StrengthTile from "./StrengthTile";

const moves = [
  ["ยืดอก ศอกพิงกำแพง", "Wall Chest Stretch (Elbow)", "งอศอกประมาณ 90° วางศอกและแขนท่อนล่างบนกำแพงระดับไหล่ แล้วก้าวไปด้านหน้าจนตึงพอดี"],
  ["ยืดอก แขนตรงพิงกำแพง", "Wall Chest Stretch (Straight Arm)", "เหยียดแขนแนบกำแพงระดับไหล่ แล้วค่อย ๆ โน้มตัวไปด้านหน้า"],
  ["ยืดอก กรอบประตู", "Doorway Chest Stretch", "วางแขนสองข้างบนกรอบประตูที่ระดับไหล่ แล้วก้าวผ่านกรอบประตูจนตึงพอดี"],
] as const;

type Phase = { move: number; side: string; rep: number; label: string; seconds: number };
function phasesFor(indices: number[]) {
  const phases: Phase[] = [];
  for (const [index, move] of indices.entries()) {
    const sides = move === 2 ? ["สองข้างพร้อมกัน"] : ["ขวา", "ซ้าย"];
    for (const side of sides) {
      if (side === "ซ้าย") phases.push({ move, side, rep: 1, label: "เปลี่ยนข้าง", seconds: 10 });
      for (let rep = 1; rep <= 3; rep++) {
        phases.push({ move, side, rep, label: "ยืด", seconds: 10 });
        if (rep < 3) phases.push({ move, side, rep, label: "พัก", seconds: 10 });
      }
    }
    if (index < indices.length - 1)
      phases.push({ move: indices[index + 1], side: "", rep: 1, label: "เปลี่ยนท่า", seconds: 15 });
  }
  return phases;
}
type Timer = { indices: number[]; started: number; pausedAt?: number };
const caution = "ยืดจนตึงพอดี หายใจตามปกติ ไหล่ไม่ยัก หยุดหากชาหรือเจ็บแปลบ";
function readTimer(stored: string | null): Timer | null {
  try {
    const timer = JSON.parse(stored ?? "null") as Timer | null;
    return timer && Array.isArray(timer.indices) && timer.indices.length &&
      timer.indices.every((index) => Number.isInteger(index) && index >= 0 && index < moves.length) &&
      Number.isFinite(timer.started) && (timer.pausedAt === undefined || Number.isFinite(timer.pausedAt)) ? timer : null;
  } catch {
    return null;
  }
}

export default function Stretch({ query, showProgram }: { query: string; showProgram: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [stored, setStored] = useRememberedView("stretch-timer");
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
  const start = (indices: number[]) => {
    setSelected(null);
    saveTimer({ indices, started: Date.now() });
  };
  const seek = (seconds: number) => {
    if (!timer) return;
    const time = Date.now();
    saveTimer({ ...timer, started: time - seconds * 1000, pausedAt: timer.pausedAt ? time : undefined });
  };
  return (
    <>
      {moves.map(([thai, english], index) => {
        if (!`${thai} ${english}`.toLowerCase().includes(query.trim().toLowerCase())) return null;
        return (
          <StrengthTile key={english} name={english} thai={thai} group="Stretch · อก" location={homeGym}
            photo={<div className="photo-empty"><Activity size={36} aria-hidden="true" /></div>}
            onClick={() => setSelected(index)}>
            <div className="last-load">
              <span>{index === 2 ? "สองข้างพร้อมกัน" : "ขวาและซ้าย"}</span>
              <strong>3 ครั้ง · ค้าง 10 วิ</strong><ArrowUpRight size={17} />
            </div>
          </StrengthTile>
        );
      })}
      {showProgram && !query.trim() && (
        <button className="secondary" onClick={() => start([0, 1, 2])}>เริ่ม Chest Stretch ทั้งชุด · 5 นาที</button>
      )}
      {selected !== null && <Modal title={moves[selected][0]} close={() => setSelected(null)}>
        <div className="detail-body">
          <div className="focus-title"><small>{homeGym} · Stretch · อก</small><h3>{moves[selected][1]}</h3></div>
          <div><h4>วิธีเล่น</h4><p>{moves[selected][2]}</p><p>{caution}</p></div>
          <button className="primary" onClick={() => start([selected])}>เริ่มท่านี้</button>
        </div>
      </Modal>}
      {timer && <Modal title="Chest Stretch" close={() => saveTimer(null)}>
        <div className="form">
          {current ? <>
            <div className={`notice stretch-phase ${current.label === "ยืด" ? "active" : ""}`}>
              <h3>{current.label} · {remaining} วิ</h3>
              <p>{moves[current.move][0]} {current.side && `· ${current.side}`} · ครั้ง {current.rep}/3</p>
              <p>{moves[current.move][2]}</p>
            </div>
            <progress max={total} value={Math.min(elapsed, total)} aria-label="ความคืบหน้าการยืด" />
            <div className="upload-row">
              <button className="secondary" onClick={() => seek(Math.max(0, offset - (phases[phases.indexOf(current) - 1]?.seconds ?? 0)))}>ย้อนช่วง</button>
              <button className="primary" onClick={() => {
                const time = Date.now();
                saveTimer(timer.pausedAt ? { ...timer, started: timer.started + time - timer.pausedAt, pausedAt: undefined } :
                  { ...timer, pausedAt: time });
              }}>{timer.pausedAt ? "ทำต่อ" : "พักตัวจับเวลา"}</button>
              <button className="secondary" onClick={() => seek(offset + current.seconds)}>ข้ามช่วง</button>
            </div>
          </> : <><h3>ถึงท้ายโปรแกรมแล้ว</h3><button className="primary" onClick={() => saveTimer(null)}>ปิดตัวจับเวลา</button></>}
        </div>
      </Modal>}
    </>
  );
}
