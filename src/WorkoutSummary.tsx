import { Medal } from "lucide-react";
import BodyMap, { MuscleBars } from "./BodyMap";
import { dateLabel, formatSet } from "./core";
import { musclesFor, muscleBenefits, muscleText } from "./muscles";
import { isStretch } from "./stretchTraining";
import { compareExercise, kg, machineRecords, minutesText, muscleSets, recordLabels, sessionMinutes, sessionRecords,
  sessionSets, sessionVolume, trainingStreak } from "./workoutStats";
import type { Entry, Machine, Session } from "./types";

const signed = (value: number, unit: string) =>
  `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toLocaleString("th-TH", { maximumFractionDigits: 1 })} ${unit}`;

/** Time, volume, sets and records in one line; parts that are unknown are left out. */
export function WorkoutNumbers({ entry, entries }: { entry: Entry; entries: Entry[] }) {
  const session = entry.data as Session;
  const minutes = sessionMinutes(session);
  const volume = sessionVolume(session);
  const sets = sessionSets(session);
  const records = session.status === "draft" ? 0 : sessionRecords(entries, entry).reduce((sum, { kinds }) => sum + kinds.length, 0);
  if (!sets && !minutes) return null;
  return (
    <dl className="workout-numbers">
      {minutes !== undefined && <div><dt>เวลา</dt><dd>{minutesText(minutes)}</dd></div>}
      {volume > 0 && <div><dt>ปริมาณ</dt><dd>{kg(volume)}</dd></div>}
      <div><dt>เซต</dt><dd>{sets}</dd></div>
      {records > 0 && <div className="has-record"><dt>สถิติใหม่</dt><dd><Medal size={15} aria-hidden="true" /> {records}</dd></div>}
    </dl>
  );
}

export default function WorkoutSummary({ entry, entries }: { entry: Entry; entries: Entry[] }) {
  const session = entry.data as Session;
  const machines = new Map(entries.filter((e) => e.kind === "machine").map((e) => [e.id, e.data as Machine]));
  const records = new Map(sessionRecords(entries, entry).map(({ machineId, kinds }) => [machineId, kinds]));
  const { sets, unknown } = muscleSets(entries, [session]);
  const streak = trainingStreak(entries);
  const done = session.exercises.filter((x) => x.sets.some((set) => set.done));
  return (
    <div className="workout-summary">
      <p className="muted">{dateLabel(session.date)}{streak > 1 && ` · ฝึกต่อเนื่อง ${streak} สัปดาห์`}</p>
      <WorkoutNumbers entry={entry} entries={entries} />
      {Object.keys(sets).length > 0 && (
        <section>
          <h3>กล้ามเนื้อที่ได้วันนี้</h3>
          <BodyMap sets={sets} />
          <MuscleBars sets={sets} />
          <p className="muted">นับเซตจริง · กล้ามเนื้อหลัก 1 เซต ตัวช่วยครึ่งเซต{unknown > 0 && ` · อีก ${unknown} เซตยังไม่ระบุกล้ามเนื้อ`}</p>
        </section>
      )}
      {done.length > 0 && (
        <section>
          <h3>เทียบกับครั้งก่อนของเครื่องเดิม</h3>
          <ul className="compare-list">
            {done.map((x) => {
              const compared = isStretch(x.machineId) ? undefined : compareExercise(entries, entry, x);
              const kinds = records.get(x.machineId);
              const parts = compared && [
                compared.weight ? signed(compared.weight, "กก.") : undefined,
                compared.volume !== undefined ? `ปริมาณ ${signed(compared.volume, "กก.")}` : signed(compared.reps, "ครั้ง"),
              ].filter(Boolean);
              return (
                <li key={x.machineId}>
                  <strong>{machines.get(x.machineId)?.name ?? x.originalName ?? "ท่าที่บันทึกไว้"}</strong>
                  <span>{x.sets.filter((set) => set.done).map((set) => formatSet(set, x.loadMode)).join(" / ")}</span>
                  {compared && <small className={(compared.volume ?? compared.reps) < 0 ? "lower" : ""}>{parts!.join(" · ")} จาก {dateLabel(compared.date)}</small>}
                  {!compared && !isStretch(x.machineId) && !x.reportedOnly && <small>บันทึกครั้งแรกของเครื่องนี้</small>}
                  {kinds && <small className="record"><Medal size={14} aria-hidden="true" /> {kinds.map((kind) => recordLabels[kind]).join(" · ")}</small>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** What an exercise trains and the records on this machine. */
export function MachineInsights({ id, machine, entries }: { id: string; machine: Machine; entries: Entry[] }) {
  if (isStretch(id)) return null;
  const { primary, secondary } = musclesFor(machine);
  const records = machineRecords(entries, id);
  const rows = ([
    ["น้ำหนักมากสุด", records.weight, "กก."], ["1RM โดยประมาณ", records.max, "กก."], ["ปริมาณต่อเซต", records.volume, "กก."],
    ["ปริมาณต่อครั้งฝึก", records.session, "กก."], ["จำนวนครั้งมากสุด", records.reps, "ครั้ง"],
  ] as const).flatMap(([label, best, unit]) => best ? [{ label, best, unit }] : []);
  return (
    <>
      <div>
        <h4>ท่านี้ได้อะไร</h4>
        {primary.length || secondary.length ? (
          <div className="muscle-focus">
            <BodyMap sets={Object.fromEntries([...secondary.map((m) => [m, 0.4]), ...primary.map((m) => [m, 1])])} />
            <div>
              {primary.length > 0 && <p><strong>เน้น:</strong> {muscleText(primary)}</p>}
              {secondary.length > 0 && <p><strong>ช่วย:</strong> {muscleText(secondary)}</p>}
              {primary.map((m) => <p className="muted" key={m}>{muscleBenefits[m]}</p>)}
            </div>
          </div>
        ) : <p className="muted">ยังไม่ระบุ เลือกกล้ามเนื้อได้ที่ “แก้ไขรายละเอียด”</p>}
      </div>
      {rows.length > 0 && (
        <div>
          <h4>สถิติของเครื่องนี้</h4>
          <dl className="record-list">
            {rows.map(({ label, best, unit }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{best.value.toLocaleString("th-TH", { maximumFractionDigits: 1 })} {unit}<small>{dateLabel(best.date)}</small></dd>
              </div>
            ))}
          </dl>
          {records.byReps.length > 1 && (
            <details>
              <summary>น้ำหนักมากสุดตามจำนวนครั้ง</summary>
              <dl className="record-list">
                {records.byReps.map(([reps, best]) => (
                  <div key={reps}><dt>{reps} ครั้ง</dt><dd>{kg(best.value)}<small>{dateLabel(best.date)}</small></dd></div>
                ))}
              </dl>
            </details>
          )}
        </div>
      )}
    </>
  );
}
