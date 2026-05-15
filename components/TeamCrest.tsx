import { memo } from "react";

type Props = {
  name: string;
  shortName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  size?: number;
  className?: string;
};

function initialsFor(name: string, shortName?: string | null) {
  if (shortName && shortName.trim()) return shortName.trim().slice(0, 3).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// WCAG-ish contrast helper: pick white or near-black against a color
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function contrastText(hex: string): string {
  return luminance(hex) > 0.6 ? "#1f2937" : "#ffffff";
}

export const TeamCrest = memo(function TeamCrest({
  name,
  shortName,
  primaryColor = "#1f2937",
  secondaryColor = "#f3f4f6",
  size = 32,
  className,
}: Props) {
  const primary = primaryColor || "#1f2937";
  const secondary = secondaryColor || "#f3f4f6";
  const initials = initialsFor(name, shortName);
  const idSafe = name.replace(/[^a-zA-Z0-9]/g, "_");
  const clipId = `clip-${idSafe}`;
  const textColor = contrastText(primary);
  // Strengthen border when primary is very light (e.g., Juventus white-on-white)
  const isLight = luminance(primary) > 0.85;
  const borderColor = isLight ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)";
  const borderWidth = isLight ? 2 : 1.5;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-label={`Grb tima ${name}`}
      role="img"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M8 6 H56 V36 Q56 50 32 60 Q8 50 8 36 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="64" height="64" fill={primary} />
        <polygon points="64,0 64,64 0,64" fill={secondary} />
      </g>
      <path
        d="M8 6 H56 V36 Q56 50 32 60 Q8 50 8 36 Z"
        fill="none"
        stroke={borderColor}
        strokeWidth={borderWidth}
      />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={initials.length >= 3 ? 18 : 22}
        fontWeight="700"
        fill={textColor}
        style={{ paintOrder: "stroke" }}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="0.6"
      >
        {initials}
      </text>
    </svg>
  );
});

export type TeamLite = {
  id: string;
  name: string;
  short_name?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};

export function TeamLabel({ team, size = 24, className }: { team: TeamLite | null | undefined; size?: number; className?: string }) {
  if (!team) return <span className="text-zinc-400">?</span>;
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <TeamCrest
        name={team.name}
        shortName={team.short_name}
        primaryColor={team.primary_color}
        secondaryColor={team.secondary_color}
        size={size}
      />
      <span className="truncate">{team.name}</span>
    </span>
  );
}
