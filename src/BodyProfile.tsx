import { useState } from "react";
import { BodyForm, Modal, useData } from "./App";
import { archivedInBody, assessBmi, assessWaist, bmiReference, bodyMetrics, bodyMetricSeries, reportUrl, sizingFields, sizingId, sizingTextFields, waistReference } from "./bodyDetails";
import type { BodyMetricDetail } from "./BodyMetricChart";
import { dateLabel, today } from "./core";
import { save } from "./db";
import type { Entry } from "./types";

export default function BodyProfile({ bodies, reports, openMetric, height }: {
  bodies: Entry[];
  reports: ReturnType<typeof archivedInBody>;
  openMetric: (detail: BodyMetricDetail) => void;
  height?: number;
}) {
  const { entries, run } = useData();
  const sizing = entries.find((entry) => entry.id === sizingId && !entry.deleted)?.data;
  const dates = [...new Set([...reports.keys(), ...bodies.map((entry) => entry.data.date as string)])].sort().reverse();
  const [reportDate, setReportDate] = useState("");
  const [editing, setEditing] = useState(false);
  const [bodyEdit, setBodyEdit] = useState<Entry | null | undefined>(undefined);
  const date = dates.includes(reportDate) ? reportDate : dates.find((item) => reports.has(item)) ?? dates[0];
  const report = date ? reports.get(date) : undefined;
  const measurements = bodies.filter((entry) => entry.data.date === date);
  const links = new Map((report?.links ?? []).map((link) => [link.url, link.label]));
  for (const entry of measurements) {
    const url = reportUrl(entry.data.reportUrl);
    if (url) links.set(url, "เปิด PDF / เอกสารที่แนบ");
  }
  const lastHeight = bodyMetricSeries([], reports, "height", "ส่วนสูง", "cm").at(-1);
  const waist = [...bodies].reverse().find((entry) => entry.data.waist != null);
  const known = {
    height: lastHeight,
    waist: waist && { value: waist.data.waist, date: waist.data.date },
  };
  function viewReportMetric(label: string, value: number, unit: string, cutoff: string, note?: string): BodyMetricDetail {
    const key = bodyMetrics.find(([, , , archiveLabel]) => archiveLabel === label)?.[0] ?? "";
    const savedHeight = bodyMetricSeries([], reports, "height", "ส่วนสูง", "cm")
      .filter((point) => point.date <= cutoff).at(-1)?.value ?? height;
    const measuredBmi = reports.get(cutoff)?.metrics.find((metric) => metric.label === "BMI");
    const weightBmi = measuredBmi ? Number(measuredBmi.value) :
      savedHeight && savedHeight > 0 ? value / (savedHeight / 100) ** 2 : undefined;
    const usesBmi = key === "bmi" || (key === "weight" && weightBmi !== undefined);
    const assessment = key === "bmi" ? assessBmi(value) : key === "weight" && weightBmi !== undefined ? assessBmi(weightBmi) :
      key === "waist" && savedHeight && savedHeight > 0 ? assessWaist(value, savedHeight) : undefined;
    const earlier = bodyMetricSeries(bodies, reports, key, label, unit === "ซม." || unit === "กก." ? undefined : unit)
      .filter((point) => point.date < cutoff);
    return {
      label, unit, assessment,
      note: [note, usesBmi && "BMI เป็นเกณฑ์คัดกรองและแยกมวลกล้ามเนื้อกับไขมันไม่ได้"].filter(Boolean).join(" · "),
      points: [...earlier, { date: cutoff, value }],
      reference: usesBmi ? bmiReference : assessment ? waistReference : undefined,
    };
  }

  return (
    <>
      <section className="panel">
        <div className="section-title">
          <h2>สัดส่วนและไซส์เสื้อผ้า</h2>
          <button className="secondary edit-only" onClick={() => setEditing(true)}>แก้ไขสัดส่วน</button>
        </div>
        {sizing?.date && <p className="muted">บันทึกสัดส่วน {dateLabel(sizing.date)}</p>}
        <dl className="body-details-grid">
          {sizingFields.map(([key, label]) => {
            const imported = key === "height" || key === "waist" ? known[key] : undefined;
            const manual = sizing?.values?.[key];
            const value = manual || imported?.value;
            const measuredOn = manual ? sizing?.date : imported?.date;
            const numeric = Number(value);
            const unit = sizingTextFields.includes(key) ? "" : "ซม.";
            const clickable = !!(unit && measuredOn && Number.isFinite(numeric) && numeric > 0);
            const openSizing = () => {
              const history = key === "waist" ? bodyMetricSeries(bodies, reports, key, label)
                : key === "height" ? bodyMetricSeries([], reports, key, label, "cm") : [];
              const points = [...history.filter((point) => point.date !== measuredOn), { date: measuredOn, value: numeric }]
                .sort((a, b) => a.date.localeCompare(b.date));
              openMetric({ label, unit, points, note: "สัดส่วนสำหรับเทียบตารางไซส์" });
            };
            return (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{clickable
                  ? <button className="body-value-button" type="button" onClick={openSizing}>{value} {unit}</button>
                  : value || "—"}</dd>
                {!manual && imported?.date && <small>{dateLabel(imported.date)}</small>}
              </div>
            );
          })}
        </dl>
        {sizing?.note && <p className="preserve">{sizing.note}</p>}
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>InBody และผลวัดร่างกาย</h2>
          {dates.length > 0 && <select aria-label="วันที่ดูผล InBody" value={date} onChange={(event) => setReportDate(event.target.value)}>
            {dates.map((item) => <option key={item} value={item}>{dateLabel(item)}</option>)}
          </select>}
        </div>
        {report?.metrics.length ? (
          <dl className="body-details-grid">
            {report.metrics.map(({ label, value, unit, note }, index) => {
              const numeric = Number(value);
              const detail = Number.isFinite(numeric) && date ? viewReportMetric(label, numeric, unit, date, note) : undefined;
              const formatted = [value, unit].filter(Boolean).join(" ");
              return <div key={`${label}-${index}`} className={`metric-status ${detail?.assessment?.tone ?? ""}`}>
                <dt>{label}</dt><dd>{detail ? <button type="button" className="body-value-button" onClick={() => openMetric(detail)}>{formatted}</button> : formatted}</dd>
                {detail?.assessment && <small>{detail.assessment.label}</small>}
                {note && <small>{note}</small>}
              </div>;
            })}
          </dl>
        ) : measurements.map((entry) => (
          <dl className="body-details-grid" key={entry.id}>
            {([["weight", "น้ำหนัก", "กก."], ["waist", "รอบเอว", "ซม."], ["fat", "ไขมัน", "%"], ["smm", "มวลกล้ามเนื้อ", "กก."]] as const)
              .filter(([key]) => entry.data[key] != null)
              .map(([key, label, unit]) => {
                const archiveLabel = bodyMetrics.find(([metric]) => metric === key)?.[3] ?? label;
                const detail = viewReportMetric(archiveLabel, entry.data[key], unit, entry.data.date);
                return <div key={key} className={`metric-status ${detail.assessment?.tone ?? ""}`}><dt>{label}</dt>
                  <dd><button type="button" className="body-value-button" onClick={() => openMetric({ ...detail, label })}>{entry.data[key]} {unit}</button></dd>
                  {detail.assessment && <small>{detail.assessment.label}</small>}</div>;
              })}
          </dl>
        ))}
        <div className="upload-row">
          {[...links].map(([url, label]) => (
            <a key={url} className="secondary" href={url} target="_blank" rel="noreferrer">{label}</a>
          ))}
          {measurements.map((entry) => <button key={entry.id} className="text-button edit-only" onClick={() => setBodyEdit(entry)}>แก้ไขผล / แนบลิงก์ PDF</button>)}
          {!measurements.length && <button className="secondary edit-only" onClick={() => setBodyEdit(null)}>บันทึกผล / แนบลิงก์ PDF</button>}
        </div>
      </section>
      {bodyEdit !== undefined && <BodyForm entry={bodyEdit ?? undefined} close={() => setBodyEdit(undefined)} />}
      {editing && (
        <Modal title="แก้ไขสัดส่วนและไซส์" close={() => setEditing(false)}>
          <form className="form" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const values = Object.fromEntries(sizingFields.map(([key]) => [key, String(form.get(key) ?? "").trim()]).filter(([, value]) => value));
            void run(async () => {
              await save("settings", { date: String(form.get("date")), values, note: String(form.get("note")).trim() }, sizingId);
              setEditing(false);
            }, "บันทึกสัดส่วนแล้ว");
          }}>
            <label>วันที่วัด<input type="date" name="date" required defaultValue={today()} /></label>
            <div className="form-grid">
              {sizingFields.map(([key, label]) => {
                const text = sizingTextFields.includes(key);
                return <label key={key}>{label}{!text && " (ซม.)"}
                  <input name={key} type={text ? "text" : "number"} min={text ? undefined : "0.1"} max={text ? undefined : "400"}
                    maxLength={text ? 100 : undefined} step={text ? undefined : "any"} defaultValue={sizing?.values?.[key] ?? ""} />
                </label>;
              })}
            </div>
            <label>หมายเหตุ เช่น แบรนด์หรือรุ่นที่ใส่พอดี<textarea name="note" maxLength={1000} defaultValue={sizing?.note ?? ""} /></label>
            <button className="primary">บันทึกสัดส่วน</button>
          </form>
        </Modal>
      )}
    </>
  );
}
