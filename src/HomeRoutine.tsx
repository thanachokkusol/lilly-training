import { useState } from "react";
import { useData } from "./App";
import { allEntries, save } from "./db";
import { exerciseGuide, homeGym, homeMoves, homeRoutineId } from "./homeTraining";

export function HomeRoutineSetup() {
  const { entries, run } = useData();
  const [busy, setBusy] = useState(false);
  if (entries.some((entry) => entry.id === homeRoutineId && !entry.deleted)) return null;
  return (
    <details className="home-routine">
      <summary>โปรแกรมที่บ้าน · เวททั้งตัว</summary>
      <p>เคตเทิลเบล 5 กก. และดัมเบลข้างละ 2.5 / 5 / 10 กก.</p>
      <ol>{homeMoves.map((move) => <li key={move.id}>{move.thai}</li>)}</ol>
      <p>ลอง 1–2 เซ็ตต่อท่า เซ็ตละ 8–12 ครั้ง พัก 60–90 วินาที เลือกน้ำหนักที่คุมท่าได้</p>
      <p><a href="https://www.nasm.org/workout-exercise-guidance" target="_blank" rel="noreferrer">ดูคลังวิธีเล่นของ NASM</a></p>
      <button className="secondary" disabled={busy} onClick={() => {
        setBusy(true);
        void run(async () => {
          const existing = new Map((await allEntries()).map((entry) => [entry.id, entry]));
          const ids: string[] = [];
          for (const { id, ...move } of homeMoves) {
            const current = existing.get(id);
            if (current?.deleted || current?.data.archived) continue;
            if (!current) await save("machine", { ...move, gym: homeGym }, id);
            ids.push(id);
          }
          if (!ids.length) throw Error("ท่าที่บ้านอยู่ในคลังหรือถังขยะทั้งหมด");
          await save("routine", {
            title: "ที่บ้าน · เวททั้งตัว", machineIds: ids, days: [],
            note: "เลือกน้ำหนักที่คุมท่าได้ บันทึกเฉพาะเซ็ตที่ทำจริง",
          }, homeRoutineId);
        }, "เพิ่มโปรแกรมที่บ้านแล้ว").finally(() => setBusy(false));
      }}>เพิ่มโปรแกรมที่บ้าน</button>
    </details>
  );
}

export function ExerciseIllustration({ name }: { name: string }) {
  const guide = exerciseGuide(name);
  if (!guide) return null;
  return (
    <details className="exercise-guide">
      <summary>ภาพประกอบวิธีเล่น</summary>
      <p className="muted">ภาพสาธิตทั่วไป · เบาะหรือด้ามจับอาจต่างจากเครื่องจริง</p>
      <div className="exercise-guide-frames">
        {["มุมสาธิต 1", "มุมสาธิต 2"].map((label, i) => (
          <figure key={label}>
            <img loading="lazy" src={`${import.meta.env.BASE_URL}exercise-guides/${guide}/${i}.jpg`} alt={`${name} · ${label}`} />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      </div>
      <small><a href="https://yuhonas.github.io/free-exercise-db/" target="_blank" rel="noreferrer">ภาพจาก Free Exercise DB</a></small>
    </details>
  );
}
