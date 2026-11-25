import { useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts";
import ExerciseChart from "./ExerciseChart";
import TrainingCalendar from "./TrainingCalendar";
import TrainingStats from "./TrainingStats";
import BodyProfile from "./BodyProfile";
import { isStretch } from "./stretchTraining";
import { isPendingMachine } from "./pendingMachines";
import { BodyMetricChart, BodyMetricDialog, type BodyMetricDetail } from "./BodyMetricChart";
import { archivedInBody, assessBmi, assessWaist, bmiReference, bodyMetrics, bodyMetricSeries, sizingId, waistReference } from "./bodyDetails";
import {
  today,
  weekOf,
  addDays,
  dateLabel,
  cardioTotals,
  minuteDuration,
  exerciseKey,
} from "./core";
import { useData, Header, BodyForm, useRememberedView } from "./App";
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("th-TH-u-ca-gregory", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(d + "T12:00:00Z"));
export default function Progress() {
  const { entries } = useData(),
    [metric, setMetric] = useState<string>("weight"),
    [detail, setDetail] = useState<BodyMetricDetail | null>(null),
    [machine, setMachine] = useState(""),
    [bodyForm, setBodyForm] = useRememberedView("new-body-form");
  const active = entries.filter((e) => !e.deleted),
    bodies = active
      .filter((e) => e.kind === "body")
      .sort((a, b) => a.data.date.localeCompare(b.data.date)),
    machines = active
      .filter((e) => e.kind === "machine" && !isStretch(e.id) && !isPendingMachine(e))
      .sort(
        (a, b) =>
          Number(b.data.gym === "WE Fitness") -
            Number(a.data.gym === "WE Fitness") ||
          a.data.name.localeCompare(b.data.name),
      ),
    exercises = Array.from(new Map(machines
      .map((m) => [exerciseKey(m.data), m])).entries()),
    chosen = exercises.some(([key]) => key === machine) ? machine : exercises[0]?.[0];
  const reports = archivedInBody(entries);
  const heightPoints = bodyMetricSeries([], reports, "height", "ส่วนสูง", "cm");
  const sizing = active.find((entry) => entry.id === sizingId)?.data;
  const manualHeight = Number(sizing?.values?.height);
  const height = manualHeight > 0 && (!heightPoints.length || sizing.date >= heightPoints.at(-1)!.date)
    ? manualHeight : heightPoints.at(-1)?.value;
  const weights = bodyMetricSeries(bodies, reports, "weight", "น้ำหนัก");
  const recordedBmi = bodyMetricSeries(bodies, reports, "bmi", "BMI");
  const bmiByDate = new Map(recordedBmi.map(({ date, value }) => [date, value]));
  if (height && height > 0) {
    for (const weight of weights) {
      if (!bmiByDate.has(weight.date)) bmiByDate.set(weight.date, weight.value / (height / 100) ** 2);
    }
  }
  const progressMetrics = bodyMetrics.map(([key, label, unit, archiveLabel]) => {
    const points = key === "bmi"
      ? [...bmiByDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({
        date, value: recordedBmi.find((point) => point.date === date)?.value ?? Number(value.toFixed(3)),
      }))
      : bodyMetricSeries(bodies, reports, key, archiveLabel);
    const latest = points.at(-1);
    const bmi = key === "bmi" ? (latest && bmiByDate.get(latest.date))
      : key === "weight" && latest ? bmiByDate.get(latest.date) : undefined;
    const waist = key === "waist" && latest && height && height > 0;
    return {
      key, label, unit, points, latest,
      assessment: bmi !== undefined ? assessBmi(bmi) : waist ? assessWaist(latest.value, height) : undefined,
      reference: bmi !== undefined ? bmiReference : waist ? waistReference : undefined,
      note: bmi !== undefined
        ? `${recordedBmi.some((point) => point.date === latest?.date) ? "BMI จากใบผลวัด" : `BMI คำนวณจากน้ำหนักและส่วนสูงที่บันทึก ${height} ซม.`} · BMI เป็นเกณฑ์คัดกรองและแยกมวลกล้ามเนื้อกับไขมันไม่ได้`
        : ["fat", "smm"].includes(key) ? "เทียบการเปลี่ยนแปลงจากวิธีวัดเดียวกัน และใช้ช่วงอ้างอิงในใบผล InBody" : undefined,
    };
  });
  const chart = progressMetrics.find(({ key }) => key === metric) ?? progressMetrics[0];
  const goal = active.find((entry) => entry.id === "settings-main")?.data.cardioGoal ?? 150;
  const weeks = Array.from({ length: 8 }, (_, i) =>
    addDays(weekOf(today()), (i - 7) * 7),
  );
  const currentWeek = weekOf(today());
  const cardioWeeks = weeks.map((week) => {
    const { seconds } = cardioTotals(active, week);
    return { week: shortDate(week), minutes: seconds / 60, seconds, current: week === currentWeek };
  });
  const cardioMax = Math.ceil(Math.max(goal, ...cardioWeeks.map(({ minutes }) => minutes)) / 50) * 50;
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
      <TrainingCalendar entries={entries} />
      <TrainingStats entries={active} />
      <section className="panel">
        <div className="section-title">
          <h2>แนวโน้มรูปร่าง</h2>
          <select
            aria-label="ตัวชี้วัดรูปร่าง"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {progressMetrics.map(({ key, label, unit }) => <option key={key} value={key}>{label} ({unit})</option>)}
          </select>
        </div>
        <BodyMetricChart points={chart.points} unit={chart.unit} />
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
          <small className="muted">เป้า {goal} นาที · สีอ่อน = สัปดาห์นี้</small>
        </div>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart
              data={cardioWeeks}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, cardioMax]} />
              <ReferenceLine y={goal} stroke="#476c4c" strokeDasharray="5 4" />
              <Tooltip formatter={(_, __, item) => [minuteDuration(item.payload.seconds), "เวลารวม"]} />
              <Bar
                name="นาที"
                dataKey="minutes"
                fill="#6b8257"
                radius={[6, 6, 0, 0]}
              >
                {cardioWeeks.map(({ week, current }) => <Cell key={week} fill={current ? "#afbd8e" : "#6b8257"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel">
        <h2>Insights</h2>
        <div className="metric-card-grid">
          {progressMetrics.map((item) => (
            <button type="button" key={item.key} className={`metric-card metric-status ${item.assessment?.tone ?? ""}`}
              onClick={() => setDetail(item)}>
              <span>{item.label}<ChevronRight size={15} aria-hidden="true" /></span>
              <strong>{item.latest ? `${item.latest.value} ${item.unit}` : "—"}</strong>
              {item.latest && <small>{dateLabel(item.latest.date)}</small>}
              {item.assessment && <small>{item.assessment.label}</small>}
            </button>
          ))}
        </div>
      </section>
      <BodyProfile bodies={bodies} reports={reports} openMetric={setDetail} height={height} />
      {detail && <BodyMetricDialog detail={detail} close={() => setDetail(null)} />}
      {bodyForm && <BodyForm close={() => setBodyForm(null)} />}
    </>
  );
}
