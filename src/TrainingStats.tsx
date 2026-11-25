import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import BodyMap, { MuscleBars } from "./BodyMap";
import { addDays, today, weekOf } from "./core";
import { finishedSessions, kg, minutesText, muscleSets, trainingStreak, weeklyTraining } from "./workoutStats";
import type { Entry } from "./types";

const metrics = [
  ["volume", "ปริมาณ", kg],
  ["sets", "เซต", (value: number) => `${value} เซต`],
  ["sessions", "ครั้งฝึก", (value: number) => `${value} ครั้ง`],
  ["minutes", "เวลา", (value: number) => value ? minutesText(value) : "ไม่มีเวลาที่บันทึก"],
] as const;
const shortDate = (d: string) => new Intl.DateTimeFormat("th-TH-u-ca-gregory", { day: "numeric", month: "short", timeZone: "UTC" })
  .format(new Date(d + "T12:00:00Z"));

export default function TrainingStats({ entries }: { entries: Entry[] }) {
  const [metric, setMetric] = useState<(typeof metrics)[number][0]>("volume");
  const [range, setRange] = useState("week");
  const now = today();
  const [, , format] = metrics.find(([key]) => key === metric)!;
  const weeks = weeklyTraining(entries, 12, now).map((week) => ({ ...week, label: shortDate(week.week) }));
  const current = weeks.at(-1)!;
  const streak = trainingStreak(entries, now);
  const from = range === "week" ? weekOf(now) : addDays(now, range === "month" ? -29 : -89);
  const { sets, unknown } = muscleSets(entries, finishedSessions(entries, from, now));
  return (
    <>
      <section className="panel">
        <div className="section-title">
          <h2>เวท 12 สัปดาห์</h2>
          <small className="muted">{streak > 0 ? `ฝึกต่อเนื่อง ${streak} สัปดาห์` : "ยังไม่มีสัปดาห์ต่อเนื่อง"}</small>
        </div>
        <div className="chips">
          {metrics.map(([key, label]) => (
            <button key={key} className={metric === key ? "selected" : ""} aria-pressed={metric === key} onClick={() => setMetric(key)}>{label}</button>
          ))}
        </div>
        <p className="stat-now"><strong>{format(current[metric])}</strong> สัปดาห์นี้</p>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={weeks}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={44} allowDecimals={false} domain={[0, "auto"]} />
              <Tooltip formatter={(value) => [format(Number(value)), metrics.find(([key]) => key === metric)![1]]} />
              <Bar dataKey={metric} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {weeks.map(({ week }) => <Cell key={week} fill={week === current.week ? "#afbd8e" : "#6b8257"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {metric === "minutes" && <p className="muted">นับเฉพาะครั้งที่จับเวลาเริ่มและจบไว้</p>}
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>กล้ามเนื้อที่ฝึก</h2>
          <select aria-label="ช่วงเวลากล้ามเนื้อ" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="week">สัปดาห์นี้</option>
            <option value="month">30 วัน</option>
            <option value="quarter">90 วัน</option>
          </select>
        </div>
        <BodyMap sets={sets} />
        {Object.keys(sets).length ? <MuscleBars sets={sets} /> : <p className="muted">ยังไม่มีเซตที่ยืนยันในช่วงนี้</p>}
        <p className="muted">นับเซตจริง ไม่รวมวอร์มและยืดเหยียด · กล้ามเนื้อหลัก 1 เซต ตัวช่วยครึ่งเซต
          {unknown > 0 && ` · อีก ${unknown} เซตยังไม่ระบุกล้ามเนื้อ`}</p>
      </section>
    </>
  );
}
