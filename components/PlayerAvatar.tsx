import { memo } from "react";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function contrastText(hex?: string | null): string {
  if (!hex) return "#ffffff";
  const h = hex.replace("#", "");
  if (h.length < 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1f2937" : "#ffffff";
}

export const PlayerAvatar = memo(function PlayerAvatar({
  name,
  photoUrl,
  teamPrimary,
  size = 36,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  teamPrimary?: string | null;
  size?: number;
  className?: string;
}) {
  const px = `${size}px`;
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover bg-zinc-800 ${className ?? ""}`}
        style={{ width: px, height: px }}
        loading="lazy"
      />
    );
  }
  const bg = teamPrimary || "#52525b";
  const fg = contrastText(bg);
  return (
    <div
      role="img"
      aria-label={name}
      className={`rounded-full inline-flex items-center justify-center font-semibold select-none ${className ?? ""}`}
      style={{
        width: px,
        height: px,
        background: bg,
        color: fg,
        fontSize: `${Math.max(10, size * 0.42)}px`,
      }}
    >
      {initialsFor(name)}
    </div>
  );
});
