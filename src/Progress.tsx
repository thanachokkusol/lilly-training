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
} from "recharts";
import type { Session } from "./types";
import {
  today,
  weekOf,
  addDays,
  dateLabel,
  cardioTotals,
  loadLabel,
} from "./core";
import { useData, Header, Stat, Empty, BodyForm } from "./App";
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
    [bodyForm, setBodyForm] = useState(false);
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
    chosen = machine || machines[0]?.id;
  const chart = bodies.map((e) => ({
    date: dateLabel(e.data.date),
    value: e.data[metric],
  }));
  const exerciseChart = active
    .filter(
      (e) => e.kind === "session" && e.data.status !== "draft" && e.data.date,
    )
    .sort((a, b) => a.data.date.localeCompare(b.data.date))
    .flatMap((e) => {
      const x = (e.data as Session).exercises.find(
          (x) => x.machineId === chosen,
        ),
        sets =
          x?.sets.filter(
            (s) => s.done && !s.warmup && s.load !== null && s.reps !== null,
          ) ?? [];
      return sets.length
        ? [
            {
              date: dateLabel(e.data.date),
              value: Math.max(...sets.map((s) => s.load!)),
              reps: sets.map((s) => s.reps).join("/"),
            },
          ]
        : [];
    });
  const weeks = Array.from({ length: 8 }, (_, i) =>
    addDays(weekOf(today()), (i - 7) * 7),
  );
  return (
    <>
      <Header
        title="ความก้าวหน้า"
        subtitle="ผลวัดร่างกาย น้ำหนักรายเครื่อง และคาร์ดิโอรายสัปดาห์"
      >
        <button className="primary" onClick={() => setBodyForm(true)}>
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
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty text="ยังไม่มีผลวัดสำหรับตัวชี้วัดนี้" />
        )}
      </section>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>ความก้าวหน้ารายเครื่อง</h2>
            <p>น้ำหนักสูงสุดที่ยืนยันในวันนั้น · ดูจำนวนครั้งประกอบเสมอ</p>
          </div>
          <select
            aria-label="เลือกเครื่องดูกราฟ"
            value={chosen}
            onChange={(e) => setMachine(e.target.value)}
          >
            {machines.map((e) => (
              <option key={e.id} value={e.id}>
                {e.data.gym} · {e.data.name}
              </option>
            ))}
          </select>
        </div>
        {machines.find((e) => e.id === chosen)?.data.loadMode ===
          "assistance" && (
          <p className="notice">
            เครื่องแรงช่วย: แรงช่วยที่น้อยลงจึงหมายถึงรับน้ำหนักตัวเองมากขึ้น
          </p>
        )}
        {exerciseChart.length ? (
          <div className="chart">
            <ResponsiveContainer>
              <LineChart
                data={exerciseChart}
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
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="chart-tip">
                        {payload[0].payload.date}
                        <br />
                        {payload[0].value}{" "}
                        {loadLabel(
                          machines.find((e) => e.id === chosen)!.data.loadMode,
                        )}
                        <br />
                        ครั้งที่บันทึก: {payload[0].payload.reps}
                      </div>
                    ) : null
                  }
                />
                <Line
                  dataKey="value"
                  stroke="#476c4c"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty text="ยังไม่มีผลเซตที่ยืนยันสำหรับเครื่องนี้" />
        )}
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>คาร์ดิโอ 8 สัปดาห์</h2>
        </div>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart
              data={weeks.map((w) => ({
                week: dateLabel(w).replace(" 2026", ""),
                minutes: Number(
                  (cardioTotals(active, w).seconds / 60).toFixed(2),
                ),
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis />
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
      {bodyForm && <BodyForm close={() => setBodyForm(false)} />}
    </>
  );
}
