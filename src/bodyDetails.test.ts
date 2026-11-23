import { expect, it } from "vitest";
import { archivedInBody, reportUrl, sizingId } from "./bodyDetails";
import type { Entry } from "./types";
import { validateEntry } from "./validation";

it("links archived measurements and evidence by date without converting blank values to zero", () => {
  const date = "2026-10-01";
  const make = (id: string, text: string): Entry => ({
    id: `health-section-${id}`, kind: "archive", data: { text },
    dirty: false, version: 1, updatedAt: date,
  });
  const url = "https://drive.google.com/file/d/example/view";
  const reports = archivedInBody([
    make("example-values", `,วันที่ตรวจ,รายการ,ค่า,หน่วย,คำอธิบาย\n0,${date} 20:18,Fat Control,-2,kg,เครื่องเสนอ\n1,${date},BMI,,kg/m²,`),
    make("example-links", `,อัลบั้มหลักฐาน,วันที่,เปิดภาพต้นฉบับ,หมายเหตุ\n0,ผลInBodyเต็ม,${date},${url},\n1,โน้ต,${date},https://example.com/ignored,`),
  ]);
  expect(reports.get(date)).toEqual({
    metrics: [{ label: "Fat Control", value: "-2", unit: "kg", note: "เครื่องเสนอ" }],
    links: [{ label: "ผลInBodyเต็ม", url }],
  });
  expect(reportUrl("javascript:alert(1)")).toBeUndefined();
});

it("validates separately recorded clothing measurements and size systems", () => {
  const entry = { kind: "settings" as const, id: sizingId, data: {
    date: "2026-10-01", note: "", values: { chest: "97.5", shoe: "EU 42" },
  } };
  expect(() => validateEntry(entry)).not.toThrow();
  expect(() => validateEntry({ ...entry, data: { ...entry.data, values: { chest: "0" } } })).toThrow();
});
