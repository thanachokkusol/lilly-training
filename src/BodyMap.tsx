import { useEffect, useState } from "react";
import { muscleLabels, type Muscle } from "./muscles";

// The outline is drawn only where it is shown, so it stays out of the first download.
type Paths = typeof import("./bodyPaths").bodyPaths;
let loaded: Paths | undefined;
const shades = ["#c9dc9b", "#9fc27c", "#6b9d5f", "#3d7549", "#1f5237"];
/** Front and back view; the more sets a muscle has, the darker it is drawn. */
export default function BodyMap({ sets }: { sets: Partial<Record<Muscle, number>> }) {
  const [paths, setPaths] = useState(loaded);
  useEffect(() => {
    if (paths) return;
    let live = true;
    void import("./bodyPaths").then((file) => {
      loaded = file.bodyPaths;
      if (live) setPaths(loaded);
    }).catch(() => { /* The list of muscles below still says the same. */ });
    return () => { live = false; };
  }, []);
  const max = Math.max(0, ...Object.values(sets));
  const fill = (slug: string) => {
    const value = sets[slug as Muscle];
    if (!value || !max) return slug === "hair" ? "#5c665c" : slug in muscleLabels ? "#dde1d5" : "#e8eae2";
    return shades[Math.min(shades.length - 1, Math.ceil((value / max) * shades.length) - 1)];
  };
  const label = Object.entries(sets).filter(([, value]) => value)
    .sort(([, a], [, b]) => b - a).map(([muscle]) => muscleLabels[muscle as Muscle]).join(" ");
  return (
    <div className="body-map" role="img" aria-label={label ? `กล้ามเนื้อที่ใช้: ${label}` : "ยังไม่มีข้อมูลกล้ามเนื้อ"}>
      {(["front", "back"] as const).map((side) => (
        <svg key={side} viewBox={side === "front" ? "0 0 724 1448" : "724 0 724 1448"} aria-hidden="true">
          {paths?.[side].flatMap(([slug, paths]) => paths.map((d, i) => (
            <path key={`${slug}-${i}`} d={d} fill={fill(slug)} stroke="#fff" strokeWidth={3} />
          )))}
        </svg>
      ))}
    </div>
  );
}

export function MuscleBars({ sets }: { sets: Partial<Record<Muscle, number>> }) {
  const rows = (Object.entries(sets) as [Muscle, number][]).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <ul className="muscle-bars">
      {rows.map(([muscle, value]) => (
        <li key={muscle}>
          <span>{muscleLabels[muscle]}</span>
          <div><i style={{ width: `${(value / max) * 100}%` }} /></div>
          <strong>{value.toLocaleString("th-TH", { maximumFractionDigits: 1 })}</strong>
        </li>
      ))}
    </ul>
  );
}
