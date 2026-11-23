import { expect, it } from "vitest";
import { archivedInBody, assessBmi, assessWaist, reportUrl, sizingId } from "./bodyDetails";
import type { Entry } from "./types";
import { validateEntry } from "./validation";
import { cardioMix } from "./cardioMix";

it("uses the Asian adult BMI thresholds and the waist-to-height reference", () => {
  expect([18.49, 18.5, 22.99, 23, 25, 30].map((value) => assessBmi(value).tone))
    .toEqual(["watch", "normal", "normal", "watch", "high", "very-high"]);
  expect(assessWaist(85, 170).tone).toBe("normal");
  expect(assessWaist(86, 170).tone).toBe("high");
});

it("splits confirmed cardio seconds by activity, independently of walking goal eligibility", () => {
  const log = (activity: string, seconds: number, status = "confirmed"): Entry => ({
    id: activity, kind: "cardio", version: 1, updatedAt: "", dirty: false,
    data: { activity, seconds, status, walkGoal: false },
  });
  const mix = cardioMix([log("เดินลู่วิ่ง", 60), log("ต่อยมวย", 120), log("แบดมินตัน", 60), log("เดิน", 500, "review")], 200);
  expect(mix.groups.map(({ seconds }) => seconds)).toEqual([60, 120, 60]);
  expect(mix.background).toContain("25% 75%");
  expect(mix.percent).toBe(120);
  expect(mix.background).not.toContain("#ffffff20");
  expect(cardioMix([log("ต่อยมวย", 30)], 30).background).toBe(mix.groups[1].color);
  expect(cardioMix([], 9000).percent).toBe(0);
  const partial = cardioMix([log("เดิน", 1205)], 9000);
  expect(partial.percent.toFixed(1)).toBe("13.4");
  expect(partial.background).toContain(`#ffffff20 ${partial.percent}% 100%`);
});

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
