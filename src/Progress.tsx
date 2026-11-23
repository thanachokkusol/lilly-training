import { useState } from "react";
import { Plus, Scale, Target, Flame, Dumbbell } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import ExerciseChart from "./ExerciseChart";
import {
  today,
  weekOf,
  addDays,
  dateLabel,
  cardioTotals,
  exerciseKey,
} from "./core";
import { useData, Header, Stat, Empty, BodyForm, useRememberedView } from "./App";
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(d + "T12:00:00Z"));
export default function Progress() {
  const { entries } = useData(),
    [metric, setMetric] = useState("weight"),
    [machine, setMachine] = useState(""),
    [bodyForm, setBodyForm] = useRememberedView("new-body-form");
  const active = entries.filter((e) => !e.deleted),
    bodies = active
      .filter((e) => e.kind === "body")
      .sort((a, b) => a.data.date.localeCompare(b.data.date)),
    last = bodies.at(-1),
    machines = active
      .filter((e) => e.kind === "machine")
      .sort(
        (a, b) =>
          Number(b.data.gym === "WE Fitness") -
            Number(a.data.gym === "WE Fitness") ||
          a.data.name.localeCompare(b.data.name),
      ),
    exercises = Array.from(new Map(machines.map((m) => [exerciseKey(m.data), m])).entries()),
    chosen = exercises.some(([key]) => key === machine) ? machine : exercises[0]?.[0];
  const chart = bodies.map((e) => ({
    date: dateLabel(e.data.date),
    value: e.data[metric],
  }));
  const weeks = Array.from({ length: 8 }, (_, i) =>
    addDays(weekOf(today()), (i - 7) * 7),
  );
  return (
    <>
      <Header
        title="Progress"
        subtitle="ผลวัดร่างกาย น้ำหนักรายเครื่อง และคาร์ดิโอรายสัปดาห์"
      >
        <button className="primary" onClick={() => setBodyForm("open")}>
          <Plus size={18} />
          บันทึกผลวัด
        </button>
      </Header>
      {last && (
        <p className="muted measure-date">
          ผลวัดล่าสุดของแต่ละค่า · บันทึกล่าสุด {dateLabel(last.data.date)}
        </p>
      )}
      <div className="stats-row four">
        {(
          [
            ["weight", "น้ำหนัก", "กก.", <Scale key="w" />],
            ["waist", "รอบเอว", "ซม.", <Target key="t" />],
            ["fat", "ไขมัน", "%", <Flame key="f" />],
            ["smm", "กล้ามเนื้อ", "กก.", <Dumbbell key="d" />],
          ] as const
        ).map(([k, label, unit, icon]) => {
          const hit = [...bodies].reverse().find((e) => e.data[k] !== null);
          return (
            <Stat
              key={k}
              icon={icon}
              label={hit ? `${label} · ${shortDate(hit.data.date)}` : label}
              value={hit?.data[k]?.toString() ?? "–"}
              unit={unit}
            />
          );
        })}
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>แนวโน้มรูปร่าง</h2>
          <select
            aria-label="ตัวชี้วัดรูปร่าง"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            <option value="weight">น้ำหนัก (กก.)</option>
            <option value="waist">รอบเอว (ซม.)</option>
            <option value="fat">ไขมัน (%)</option>
            <option value="smm">มวลกล้ามเนื้อ (กก.)</option>
          </select>
        </div>
        {chart.some((p) => p.value !== null) ? (
          <div className="chart">
            <ResponsiveContainer>
              <LineChart
                data={chart}
                margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  padding={{ left: 14, right: 14 }}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11 }}
                  width={44}
                />
                <Tooltip />
                <Line
                  dataKey="value"
                  name="ผลวัด"
                  stroke="#476c4c"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty text="ยังไม่มีผลวัดสำหรับตัวชี้วัดนี้" />
        )}
      </section>
      <label>
        เลือกท่าดูกราฟ
        <select value={chosen ?? ""} onChange={(e) => setMachine(e.target.value)}>
          {exercises.map(([key, m]) => <option key={key} value={key}>{m.data.name}</option>)}
        </select>
      </label>
      <ExerciseChart key={chosen} entries={entries} machines={machines.filter((m) => exerciseKey(m.data) === chosen)} />
      <section className="panel">
        <div className="section-title">
          <h2>คาร์ดิโอ 8 สัปดาห์</h2>
        </div>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart
              data={weeks.map((w) => ({
                week: shortDate(w),
                minutes: Number(
                  (cardioTotals(active, w).seconds / 60).toFixed(2),
                ),
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, (max: number) => Math.max(150, max)]} />
              <ReferenceLine y={150} stroke="#476c4c" strokeDasharray="5 4" label="เป้า 150" />
              <Tooltip />
              <Bar
                name="นาที"
                dataKey="minutes"
                fill="#6b8257"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      {bodyForm && <BodyForm close={() => setBodyForm(null)} />}
    </>
  );
}
