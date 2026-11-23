import { useState } from "react";
import { BodyForm, Modal, useData } from "./App";
import { archivedInBody, reportUrl, sizingFields, sizingId, sizingTextFields } from "./bodyDetails";
import { dateLabel, today } from "./core";
import { save } from "./db";
import type { Entry } from "./types";

export default function BodyProfile({ bodies }: { bodies: Entry[] }) {
  const { entries, run } = useData();
  const sizing = entries.find((entry) => entry.id === sizingId && !entry.deleted)?.data;
  const reports = archivedInBody(entries);
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
  const height = [...reports.entries()].sort(([a], [b]) => b.localeCompare(a)).find(([, item]) =>
    item.metrics.some(({ label, unit }) => label === "ส่วนสูง" && unit === "cm"));
  const waist = [...bodies].reverse().find((entry) => entry.data.waist != null);
  const known = {
    height: height && { value: height[1].metrics.find(({ label }) => label === "ส่วนสูง")?.value, date: height[0] },
    waist: waist && { value: waist.data.waist, date: waist.data.date },
  };

  return (
    <>
      <section className="panel">
        <div className="section-title">
          <h2>สัดส่วนและไซส์เสื้อผ้า</h2>
          <button className="secondary" onClick={() => setEditing(true)}>แก้ไขสัดส่วน</button>
        </div>
        {sizing?.date && <p className="muted">บันทึกสัดส่วน {dateLabel(sizing.date)}</p>}
        <dl className="body-details-grid">
          {sizingFields.map(([key, label]) => {
            const imported = key === "height" || key === "waist" ? known[key] : undefined;
            const manual = sizing?.values?.[key];
            const value = manual || imported?.value;
            return (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{value ? `${value}${sizingTextFields.includes(key) ? "" : " ซม."}` : "—"}</dd>
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
            {report.metrics.map(({ label, value, unit, note }, index) => (
              <div key={`${label}-${index}`}><dt>{label}</dt><dd>{[value, unit].filter(Boolean).join(" ")}</dd>{note && <small>{note}</small>}</div>
            ))}
          </dl>
        ) : measurements.map((entry) => (
          <dl className="body-details-grid" key={entry.id}>
            {([["weight", "น้ำหนัก", "กก."], ["waist", "รอบเอว", "ซม."], ["fat", "ไขมัน", "%"], ["smm", "มวลกล้ามเนื้อ", "กก."]] as const)
              .filter(([key]) => entry.data[key] != null)
              .map(([key, label, unit]) => <div key={key}><dt>{label}</dt><dd>{entry.data[key]} {unit}</dd></div>)}
          </dl>
        ))}
        <div className="upload-row">
          {[...links].map(([url, label]) => (
            <a key={url} className="secondary" href={url} target="_blank" rel="noreferrer">{label}</a>
          ))}
          {measurements.map((entry) => <button key={entry.id} className="text-button" onClick={() => setBodyEdit(entry)}>แก้ไขผล / แนบลิงก์ PDF</button>)}
          {!measurements.length && <button className="secondary" onClick={() => setBodyEdit(null)}>บันทึกผล / แนบลิงก์ PDF</button>}
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
