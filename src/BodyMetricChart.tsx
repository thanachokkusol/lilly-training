import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Empty, Modal } from "./App";
import { dateLabel } from "./core";
import type { BodyAssessment, BodyMetricPoint } from "./bodyDetails";

export function BodyMetricChart({ points, unit }: { points: BodyMetricPoint[]; unit: string }) {
  if (!points.length) return <Empty text="ยังไม่มีผลวัดสำหรับตัวชี้วัดนี้" />;
  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={points.map((point) => ({ ...point, date: dateLabel(point.date) }))}
          margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} padding={{ left: 14, right: 14 }} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={46} />
          <Tooltip formatter={(value) => [`${value ?? "—"} ${unit}`.trim(), "ผลวัด"]} />
          <Line dataKey="value" stroke="#476c4c" strokeWidth={3} dot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface BodyMetricDetail {
  label: string;
  unit: string;
  points: BodyMetricPoint[];
  assessment?: BodyAssessment;
  note?: string;
  reference?: string;
}

export function BodyMetricDialog({ detail, close }: { detail: BodyMetricDetail; close: () => void }) {
  const { label, points, unit, assessment, note, reference } = detail;
  const latest = points.at(-1);
  const previous = points.at(-2);
  const difference = latest && previous ? Number((latest.value - previous.value).toFixed(3)) : undefined;
  return (
    <Modal title={label} close={close}>
      <div className="form">
        <BodyMetricChart points={points} unit={unit} />
        {latest && <p><strong>{latest.value} {unit}</strong> · {dateLabel(latest.date)}</p>}
        {latest && <p className="muted">{difference === undefined ? "มีผลวัดครั้งเดียว จึงยังดูแนวโน้มไม่ได้" :
          `เทียบครั้งก่อน: ${difference > 0 ? "+" : ""}${difference} ${unit}`}</p>}
        {assessment && <div className={`notice metric-status ${assessment.tone}`}>
          <strong>{assessment.label}</strong><br />{assessment.detail}
        </div>}
        {note && <p className="muted">{note}</p>}
        {reference && <a className="text-button" href={reference} target="_blank" rel="noreferrer">ดูเกณฑ์อ้างอิง</a>}
      </div>
    </Modal>
  );
}
