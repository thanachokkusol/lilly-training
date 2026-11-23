import type { Entry } from "./types";

export function cardioMix(logs: Entry[], goalSeconds: number) {
  const groups = [
    { label: "เดิน", color: "#e1eba9", seconds: 0 },
    { label: "มวย", color: "#ffb071", seconds: 0 },
    { label: "กิจกรรมอื่น", color: "#83c8f4", seconds: 0 },
  ];
  for (const log of logs) {
    if (log.deleted || log.kind !== "cardio" || log.data.status !== "confirmed") continue;
    const activity = log.data.activity.trim();
    const index = /มวย|\bboxing\b/i.test(activity) ? 1 :
      /เดิน|\bwalk(?:ing)?\b/i.test(activity) ? 0 : 2;
    groups[index].seconds += log.data.seconds;
  }
  const total = groups.reduce((sum, group) => sum + group.seconds, 0);
  const percent = total / goalSeconds * 100;
  const scale = Math.max(goalSeconds, total);
  const track = "#ffffff20";
  let elapsed = 0;
  const stops = groups.filter(({ seconds }) => seconds > 0).map(({ color, seconds }) => {
    const start = elapsed / scale * 100;
    elapsed += seconds;
    return `${color} ${start}% ${elapsed / scale * 100}%`;
  });
  if (total > 0 && total < goalSeconds) stops.push(`${track} ${percent}% 100%`);
  const background = stops.length > 1 ? `conic-gradient(${stops.join(", ")})` :
    groups.find(({ seconds }) => seconds > 0)?.color ?? track;
  return { groups, percent, background };
}
