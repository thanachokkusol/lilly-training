import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "./App";
import { addDays, dateLabel, formatSet, minuteDuration, today } from "./core";
import type { Cardio, Entry, Session } from "./types";

const weekdays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const monthLabel = new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
  month: "long", year: "numeric", timeZone: "UTC",
});

export default function TrainingCalendar({ entries }: { entries: Entry[] }) {
  const currentDate = today();
  const [month, setMonth] = useState(() => currentDate.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const activity = new Map<string, { strength: Entry[]; cardio: Entry[] }>();
  for (const entry of entries) {
    if (entry.deleted || !entry.data.date) continue;
    const strength = entry.kind === "session" && (entry.data.status !== "draft" ||
      (entry.data as Session).exercises.some((exercise) => exercise.sets.some((set) => set.done)));
    const cardio = entry.kind === "cardio" && entry.data.status === "confirmed";
    if (!strength && !cardio) continue;
    const day = activity.get(entry.data.date) ?? { strength: [], cardio: [] };
    (strength ? day.strength : day.cardio).push(entry);
    activity.set(entry.data.date, day);
  }
  const names = new Map(entries.filter((entry) => entry.kind === "machine")
    .map((entry) => [entry.id, entry.data.name]));
  const first = month + "-01";
  const [year, monthNumber] = month.split("-").map(Number);
  const leading = new Date(first + "T00:00:00Z").getUTCDay();
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const selectedActivity = selected ? activity.get(selected) : undefined;

  function changeMonth(offset: number) {
    setMonth(new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7));
  }

  return (
    <section className="panel">
      <div className="section-title"><h2>ปฏิทินการฝึก</h2></div>
      <div className="training-calendar-nav">
        <button type="button" className="icon" aria-label="เดือนก่อน" onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button>
        <strong aria-live="polite">{monthLabel.format(new Date(first + "T00:00:00Z"))}</strong>
        <button type="button" className="icon" aria-label="เดือนถัดไป" onClick={() => changeMonth(1)}><ChevronRight size={20} /></button>
        {month !== currentDate.slice(0, 7) && <button type="button" className="text-button" onClick={() => setMonth(currentDate.slice(0, 7))}>เดือนนี้</button>}
      </div>
      <div className="training-calendar-grid">
        {weekdays.map((day) => <span className="training-calendar-weekday" key={day}>{day}</span>)}
        {Array.from({ length: leading }, (_, index) => <span key={index} aria-hidden="true" />)}
        {Array.from({ length: days }, (_, index) => {
          const date = addDays(first, index);
          const day = activity.get(date);
          const strength = Boolean(day?.strength.length);
          const cardio = Boolean(day?.cardio.length);
          const label = [strength && "Strength", cardio && "Cardio"].filter(Boolean).join(" และ ");
          return (
            <button type="button" key={date} onClick={() => setSelected(date)}
              className="training-calendar-day"
              aria-current={date === currentDate ? "date" : undefined}
              aria-label={`${dateLabel(date)} · ${label || "ไม่มีบันทึก"}`}>
              {index + 1}
              <span className="training-calendar-markers" aria-hidden="true">
                {strength && <i className="strength-marker" />}
                {cardio && <i className="cardio-marker" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="training-calendar-legend">
        <span><i className="strength-marker" /> Strength</span>
        <span><i className="cardio-marker" /> Cardio</span>
        <span>ช่องไม่มีจุด = ไม่มีบันทึก</span>
      </div>
      {selected && (
        <Modal title={dateLabel(selected)} close={() => setSelected(null)}>
          <div className="training-calendar-details">
            {!selectedActivity && <p>ไม่มีบันทึกการฝึกวันนี้</p>}
            {!!selectedActivity?.strength.length && <h3>Strength</h3>}
            {selectedActivity?.strength.map((entry) => {
              const session: Session = entry.data;
              return (
                <article key={entry.id}>
                  <strong>{session.title}{session.status === "draft" && " · ยังฝึกไม่จบ"}</strong>
                  {session.exercises.map((exercise) => {
                    const done = exercise.sets.filter((set) => set.done);
                    if (!done.length) return null;
                    return (
                      <div key={exercise.machineId}>
                        <p>{names.get(exercise.machineId) ?? exercise.originalName ?? "ท่าที่บันทึกไว้"}</p>
                        {exercise.originalName && names.has(exercise.machineId) && names.get(exercise.machineId) !== exercise.originalName && (
                          <small className="muted">บันทึกเดิม: {exercise.originalName}</small>
                        )}
                        <ul>{done.map((set) => <li key={set.id}>{formatSet(set, exercise.loadMode)}</li>)}</ul>
                      </div>
                    );
                  })}
                  {session.summary && <p className="preserve">{session.summary}</p>}
                </article>
              );
            })}
            {!!selectedActivity?.cardio.length && <h3>Cardio</h3>}
            {selectedActivity?.cardio.map((entry) => {
              const cardio: Cardio = entry.data;
              return (
                <article key={entry.id}>
                  <strong>{cardio.activity}</strong>
                  <p>{minuteDuration(cardio.seconds)}{cardio.distance != null && ` · ${cardio.distance} กม.`}</p>
                </article>
              );
            })}
          </div>
        </Modal>
      )}
    </section>
  );
}
