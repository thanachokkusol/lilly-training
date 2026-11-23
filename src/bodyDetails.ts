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
