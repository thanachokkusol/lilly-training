import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dateLabel, exerciseProgress } from "./core";
import type { Entry } from "./types";
import { gymName } from "./gyms";

const color = (gym: string) =>
  ({ "WE Fitness": "#476c4c", Jett: "#925e32", "M Fitness": "#4864a3" })[gym] ?? "#715192";

export default function ExerciseChart({ entries, machines }: { entries: Entry[]; machines: Entry[] }) {
  const [mode, setMode] = useState<"percent" | "weight" | "max" | "volume">("percent");
  const actual = mode !== "percent";
  const [filter, setFilter] = useState("");
  const selected = machines.filter((m) => !actual || !filter || m.id === filter);
  const byId = new Map(machines.map((m) => [m.id, m]));
  const label = (m: Entry) => [gymName(entries, m.data.gym), m.data.label].filter(Boolean).join(" · ");
  const points = exerciseProgress(entries, selected.map((m) => m.id));
  return (
    <section className="panel">
      <h2>ความก้าวหน้ารายท่า</h2>
      <div className="chips">
        {([["percent", "% ความก้าวหน้า"], ["weight", "น้ำหนักจริง"], ["max", "1RM โดยประมาณ"], ["volume", "ปริมาณ"]] as const).map(([key, text]) => (
          <button key={key} className={mode === key ? "selected" : ""} aria-pressed={mode === key} onClick={() => setMode(key)}>{text}</button>
        ))}
        {actual && (
          <select aria-label="กรองเครื่องในกราฟ" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">ทุกเครื่อง</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{label(m)}</option>)}
          </select>
        )}
      </div>
      {points.length ? (
        <div className="chart">
          <ResponsiveContainer>
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={dateLabel} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit={actual ? "" : "%"} />
              <Tooltip content={({ active, payload }) => {
                const point = payload?.[0]?.payload as (typeof points)[number] | undefined;
                const machine = point && byId.get(point.machineId);
                if (!active || !point || !machine) return null;
                const set = mode === "weight" || mode === "volume" ? point.heaviest : point.best;
                return <div className="chart-tip">
                  {dateLabel(point.date)} · {label(machine)}<br />
                  {set.kg} กก. × {set.reps} ครั้ง
                  {mode === "percent" && <> · {point.percent.toFixed(1)}%</>}
                  {mode === "max" && <> · 1RM ประมาณ {point.best.estimate.toFixed(1)} กก.</>}
                  {mode === "volume" && <> · ปริมาณ {point.volume.toLocaleString("th-TH")} กก.</>}
                </div>;
              }} />
              {actual ? selected.map((m) => (
                <Line key={m.id} name={label(m)}
                  dataKey={(p: (typeof points)[number]) => p.machineId !== m.id ? null :
                    mode === "max" ? Number(p.best.estimate.toFixed(1)) : mode === "volume" ? p.volume || null : p.heaviest.kg}
                  stroke={color(m.data.gym)} connectNulls />
              )) : (
                <Line dataKey="percent" stroke="#476c4c" dot={({ cx, cy, payload }) => (
                  <circle cx={cx} cy={cy} r={4} fill={color(byId.get(payload.machineId)?.data.gym)} />
                )} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="muted">ยังไม่มีเซตที่ยืนยันและใช้คำนวณได้</p>}
      {!actual && <p className="muted">เทียบความแข็งแรงข้ามยิมเป็น % · ดูน้ำหนักจริงกดสลับด้านบน</p>}
    </section>
  );
}
