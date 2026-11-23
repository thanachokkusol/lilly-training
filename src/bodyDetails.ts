import type { Entry } from "./types";

export const sizingId = "settings-body-sizing";
export const sizingFields = [
  ["height", "ส่วนสูง"], ["neck", "รอบคอ"], ["shoulders", "ความกว้างไหล่"],
  ["chest", "รอบอก"], ["waist", "รอบเอว"], ["hips", "รอบสะโพก"],
  ["arm", "รอบต้นแขน"], ["sleeve", "ความยาวแขน"], ["wrist", "รอบข้อมือ"],
  ["back", "ความยาวหลัง"], ["thigh", "รอบต้นขา"], ["calf", "รอบน่อง"],
  ["inseam", "ความยาวขาด้านใน"], ["outseam", "ความยาวขาด้านนอก"],
  ["footLeft", "ความยาวเท้าซ้าย"], ["footRight", "ความยาวเท้าขวา"],
  ["footWidth", "ความกว้างเท้า"], ["shoe", "ไซส์รองเท้า (พร้อมระบบ EU / US / UK)"],
  ["shirt", "ไซส์เสื้อ"], ["pants", "ไซส์กางเกง"],
] as const;
export const sizingTextFields = ["shoe", "shirt", "pants"];
export const bodyMetrics = [
  ["weight", "น้ำหนัก", "กก.", "น้ำหนัก"],
  ["waist", "รอบเอว", "ซม.", "รอบเอว"],
  ["fat", "ไขมัน", "%", "ไขมัน"],
  ["smm", "มวลกล้ามเนื้อ", "กก.", "SMM"],
  ["bmi", "BMI", "กก./ม²", "BMI"],
] as const;

export type BodyMetricPoint = { date: string; value: number };
export type BodyAssessment = { label: string; tone: "normal" | "watch" | "high" | "very-high"; detail: string };
export const bmiReference = "https://phisweb.nmd.go.th/wp-content/uploads/2022/12/%E0%B8%95%E0%B8%A3%E0%B8%A7%E0%B8%88%E0%B8%AA%E0%B8%B8%E0%B8%82%E0%B8%A0%E0%B8%B2%E0%B8%9E.pdf#page=35";
export const waistReference = "https://old.nationalhealth.or.th/sites/default/files/upload_files/%E0%B8%84%E0%B8%B9%E0%B9%88%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%98%E0%B8%A3%E0%B8%A3%E0%B8%A1%E0%B8%99%E0%B8%B9%E0%B8%8D%E0%B8%AA%E0%B8%B8%E0%B8%82%E0%B8%A0%E0%B8%B2%E0%B8%9E%20%E0%B8%9E.%E0%B8%A8.2566-1_compressed_0.pdf";

export function assessBmi(value: number): BodyAssessment {
  const detail = `BMI ${value.toFixed(2)} · เกณฑ์คัดกรองผู้ใหญ่เอเชีย: 18.5 ถึงต่ำกว่า 23 อยู่ในช่วงอ้างอิง`;
  if (value < 18.5) return { tone: "watch", label: "น้ำหนักต่ำกว่าเกณฑ์ BMI", detail };
  if (value < 23) return { tone: "normal", label: "BMI อยู่ในช่วงอ้างอิง", detail };
  if (value < 25) return { tone: "watch", label: "BMI สูงกว่าช่วงอ้างอิง", detail };
  if (value < 30) return { tone: "high", label: "BMI เข้าช่วงภาวะอ้วน", detail };
  return { tone: "very-high", label: "BMI ตั้งแต่ 30 ขึ้นไป", detail };
}

export function assessWaist(waist: number, height: number): BodyAssessment {
  const ratio = waist / height;
  return {
    tone: ratio > 0.5 ? "high" : "normal",
    label: ratio > 0.5 ? "รอบเอวเกินครึ่งส่วนสูง" : "รอบเอวไม่เกินครึ่งส่วนสูง",
    detail: `รอบเอว ${waist} ซม. ÷ ส่วนสูงที่บันทึก ${height} ซม. = ${ratio.toFixed(3)} · จุดอ้างอิง 0.5`,
  };
}

export function bodyMetricSeries(bodies: Entry[], reports: ReturnType<typeof archivedInBody>, key: string, label: string, unit?: string) {
  const points = new Map<string, number>();
  for (const [date, report] of reports) {
    const item = report.metrics.find((metric) => metric.label === label && (unit === undefined || metric.unit === unit));
    if (item && Number.isFinite(Number(item.value))) points.set(date, Number(item.value));
  }
  for (const entry of bodies) {
    const value = entry.data[key];
    if (typeof value === "number" && Number.isFinite(value)) points.set(entry.data.date, value);
  }
  return [...points.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

export function reportUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch {
    return undefined;
  }
}

export function archivedInBody(entries: Entry[]) {
  const reports = new Map<string, { metrics: { label: string; value: string; unit: string; note: string }[]; links: { label: string; url: string }[] }>();
  for (const entry of entries) {
    // These archived sheet exports are already private records in the user's journal.
    if (entry.deleted || entry.kind !== "archive" || !entry.id.startsWith("health-section-") ||
      typeof entry.data.text !== "string") continue;
    const [header, ...rows] = entry.data.text.split(/\r?\n/);
    const metricSheet = header === ",วันที่ตรวจ,รายการ,ค่า,หน่วย,คำอธิบาย";
    const evidenceSheet = header === ",อัลบั้มหลักฐาน,วันที่,เปิดภาพต้นฉบับ,หมายเหตุ";
    if (!metricSheet && !evidenceSheet) continue;
    for (const row of rows) {
      const [, first, second, value, unit = "", note = ""] = row.split(",");
      const date = (metricSheet ? first : second)?.slice(0, 10);
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const report = reports.get(date) ?? { metrics: [], links: [] };
      if (metricSheet && second && value?.trim()) report.metrics.push({ label: second, value, unit, note });
      if (evidenceSheet && /inbody/i.test(first)) {
        const url = reportUrl(value);
        if (url) report.links.push({ label: first, url });
      }
      if (report.metrics.length || report.links.length) reports.set(date, report);
    }
  }
  return reports;
}
