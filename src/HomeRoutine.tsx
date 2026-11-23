import { exerciseGuide } from "./homeTraining";

export function ExerciseIllustration({ name }: { name: string }) {
  const guide = exerciseGuide(name);
  if (!guide) return null;
  return (
    <details className="exercise-guide">
      <summary>ภาพประกอบวิธีเล่น</summary>
      <p className="muted">ภาพสาธิตทั่วไป · เบาะหรือด้ามจับอาจต่างจากเครื่องจริง</p>
      <div className="exercise-guide-frames">
        {["มุมสาธิต 1", "มุมสาธิต 2"].map((label, i) => (
          <figure key={label}>
            <img loading="lazy" src={`${import.meta.env.BASE_URL}exercise-guides/${guide}/${i}.jpg`} alt={`${name} · ${label}`} />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      </div>
      <small><a href="https://yuhonas.github.io/free-exercise-db/" target="_blank" rel="noreferrer">ภาพจาก Free Exercise DB</a></small>
    </details>
  );
}
