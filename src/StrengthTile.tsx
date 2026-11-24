import type { ReactNode } from "react";

export default function StrengthTile({ name, thai, group, location, photo, children, onClick }: {
  name: string;
  thai?: string;
  group: string;
  location: string;
  photo: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="machine-tile" onClick={onClick}>
      <div className="machine-photo">
        {photo}
        <span className="gym-label">{location}</span>
      </div>
      <div className="machine-copy">
        <small>{group}</small>
        <h3>{name}</h3>
        {thai && <p>{thai}</p>}
        {children}
      </div>
    </button>
  );
}
