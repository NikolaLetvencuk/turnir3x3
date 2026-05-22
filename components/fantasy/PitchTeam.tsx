"use client";

import { useState } from "react";
import Link from "next/link";

export type PitchBreakdown = {
  goals: number;
  assists: number;
  wins: number;
  draws: number;
  losses: number;
  clean_sheets: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
};

export type PitchPlayerSlot = {
  id: string;
  name: string;
  team_name: string | null;
  team_short: string | null;
  team_primary: string | null;
  team_secondary: string | null;
  points: number;
  breakdown: PitchBreakdown | null;
  yet_to_play: boolean;
} | null;

/* ============================ JERSEY ============================ */

export function Jersey({
  primary,
  secondary,
  shortName,
  size = 88,
}: {
  primary: string;
  secondary: string | null;
  shortName?: string | null;
  size?: number;
}) {
  const p = primary || "#1f2937";
  const sleeve = secondary && secondary !== primary ? secondary : darken(p, 0.18);
  const textColor = luminance(p) > 0.6 ? "#0f172a" : "#ffffff";
  const gradId = `jersey-hl-${p.replace("#", "")}-${size}`;
  return (
    <svg
      width={size}
      height={Math.round(size * 1.05)}
      viewBox="0 0 100 105"
      aria-hidden
      style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
        </linearGradient>
      </defs>
      {/* Sleeves */}
      <path
        d="M3 18 L18 7 L30 14 L24 34 L14 38 Z"
        fill={sleeve}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <path
        d="M97 18 L82 7 L70 14 L76 34 L86 38 Z"
        fill={sleeve}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* Body */}
      <path
        d="M30 14 Q40 22 50 22 Q60 22 70 14 L76 34 L76 96 Q76 100 72 100 L28 100 Q24 100 24 96 L24 34 Z"
        fill={p}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Highlight overlay */}
      <path
        d="M30 14 Q40 22 50 22 Q60 22 70 14 L76 34 L76 96 Q76 100 72 100 L28 100 Q24 100 24 96 L24 34 Z"
        fill={`url(#${gradId})`}
      />
      {/* V-neck */}
      <path
        d="M42 18 Q50 26 58 18 L55 24 Q50 28 45 24 Z"
        fill="rgba(0,0,0,0.45)"
      />
      {/* Crest/short name */}
      {shortName && (
        <text
          x="50"
          y="68"
          textAnchor="middle"
          fontSize="22"
          fontWeight="900"
          fill={textColor}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {shortName.slice(0, 3).toUpperCase()}
        </text>
      )}
    </svg>
  );
}

function darken(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return hex;
  const r = Math.max(0, Math.floor(parseInt(h.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.floor(parseInt(h.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.floor(parseInt(h.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/* ============================ SCORING ============================ */

const POINTS = {
  goal: 4,
  assist: 2,
  win: 3,
  draw: 1,
  loss: -1,
  clean_sheet: 3,
  yellow_card: -1,
  red_card: -2,
  own_goal: -1,
} as const;

type BreakdownLine = { label: string; count: number; perPoint: number; total: number };

export function computeBreakdownLines(b: PitchBreakdown): { lines: BreakdownLine[]; total: number } {
  const items: Array<[keyof PitchBreakdown, string, number]> = [
    ["goals", "Gol", POINTS.goal],
    ["assists", "Asistencija", POINTS.assist],
    ["wins", "Pobeda", POINTS.win],
    ["draws", "Nerešeno", POINTS.draw],
    ["losses", "Poraz", POINTS.loss],
    ["clean_sheets", "Čista mreža", POINTS.clean_sheet],
    ["yellow_cards", "Žuti karton", POINTS.yellow_card],
    ["red_cards", "Crveni karton", POINTS.red_card],
    ["own_goals", "Autogol", POINTS.own_goal],
  ];
  const lines: BreakdownLine[] = [];
  let total = 0;
  for (const [key, label, perPoint] of items) {
    const count = b[key] ?? 0;
    if (!count) continue;
    const sub = count * perPoint;
    total += sub;
    lines.push({ label, count, perPoint, total: sub });
  }
  return { lines, total };
}

/* ============================ PITCH SLOT ============================ */

function PitchSlot({
  slot,
  onOpen,
  size,
}: {
  slot: PitchPlayerSlot;
  onOpen: (slot: NonNullable<PitchPlayerSlot>) => void;
  size: "sm" | "md";
}) {
  if (!slot) {
    return (
      <div className="flex flex-col items-center justify-center text-white/70 text-xs h-full">
        <div className={`${size === "md" ? "w-16 h-16" : "w-12 h-12"} rounded-full border-2 border-dashed border-white/40 inline-flex items-center justify-center text-2xl`}>+</div>
        <div className="mt-2 italic">—</div>
      </div>
    );
  }
  const lastName = slot.name.split(/\s+/).slice(-1)[0] || slot.name;
  const jerseySize = size === "md" ? 88 : 64;
  return (
    <button
      type="button"
      onClick={() => onOpen(slot)}
      className="flex flex-col items-center text-center group"
    >
      <Jersey
        primary={slot.team_primary || "#1f2937"}
        secondary={slot.team_secondary}
        shortName={slot.team_short}
        size={jerseySize}
      />
      <div className={`mt-1.5 bg-white/95 text-zinc-900 rounded-md px-2 py-0.5 ${size === "md" ? "text-xs max-w-[110px]" : "text-[10px] max-w-[80px]"} font-bold truncate`}>
        {lastName}
      </div>
      <div
        className={`mt-1 rounded-md px-2 py-0.5 ${size === "md" ? "text-sm" : "text-xs"} font-black tabular-nums shadow-sm ${
          slot.yet_to_play
            ? "bg-amber-100 text-amber-800 border border-amber-300"
            : "bg-blue-600 text-white"
        }`}
      >
        {slot.yet_to_play ? "—" : slot.points}
      </div>
      {slot.yet_to_play && size === "md" && (
        <div className="mt-1 text-[10px] text-white/85 uppercase tracking-wider font-semibold">
          Tek igra
        </div>
      )}
    </button>
  );
}

/* ============================ MODAL ============================ */

function PlayerDetailModal({
  slot,
  onClose,
  showLink = true,
}: {
  slot: NonNullable<PitchPlayerSlot>;
  onClose: () => void;
  showLink?: boolean;
}) {
  const lines = slot.breakdown ? computeBreakdownLines(slot.breakdown) : null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="shrink-0">
            <Jersey
              primary={slot.team_primary || "#1f2937"}
              secondary={slot.team_secondary}
              shortName={slot.team_short}
              size={56}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{slot.name}</div>
            <div className="text-xs text-zinc-500 truncate">{slot.team_name ?? "—"}</div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none" aria-label="Zatvori">×</button>
        </div>

        {slot.yet_to_play ? (
          <div className="card border-amber-300 bg-amber-50 text-amber-900 text-sm !p-3">
            Igrač tek treba da odigra meč u ovom kolu — zato bodova još nema.
          </div>
        ) : !lines || lines.lines.length === 0 ? (
          <div className="card !p-3 text-center">
            <div className="text-xs text-zinc-500">Bodovi u ovom kolu</div>
            <div className="text-4xl font-black tabular-nums">{slot.points}</div>
            <div className="text-xs text-zinc-500 mt-2">Igrač nije imao događaje koji nose bodove.</div>
          </div>
        ) : (
          <div className="card !p-0 overflow-hidden">
            <ul className="divide-y divide-zinc-100">
              {lines.lines.map((l) => (
                <li key={l.label} className="px-3 py-2 flex items-center gap-2 text-sm">
                  <span className="bg-zinc-100 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums shrink-0">
                    {l.count}×
                  </span>
                  <span className="flex-1 truncate">{l.label}</span>
                  <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                    {l.count} × {l.perPoint > 0 ? `+${l.perPoint}` : l.perPoint}
                  </span>
                  <span
                    className={`tabular-nums font-bold w-12 text-right shrink-0 ${
                      l.total >= 0 ? "text-blue-700" : "text-red-700"
                    }`}
                  >
                    {l.total > 0 ? `+${l.total}` : l.total}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between bg-zinc-50 border-t border-zinc-100 px-3 py-2.5">
              <span className="text-sm font-semibold">Ukupno</span>
              <span className="text-2xl font-black tabular-nums">{slot.points}</span>
            </div>
          </div>
        )}

        {showLink && (
          <Link
            href={`/players/${slot.id}`}
            className="btn-secondary w-full text-center text-sm mt-3 inline-block"
          >
            Cela statistika i istorija →
          </Link>
        )}
      </div>
    </div>
  );
}

/* ============================ PITCH ============================ */

export function PitchTeam({
  slots,
  size = "md",
  showHint = true,
}: {
  slots: PitchPlayerSlot[];
  size?: "sm" | "md";
  showHint?: boolean;
}) {
  const [openSlot, setOpenSlot] = useState<NonNullable<PitchPlayerSlot> | null>(null);
  const minHeight = size === "md" ? 280 : 200;

  return (
    <>
      <div
        className="relative rounded-2xl overflow-hidden border border-emerald-700/60 shadow-inner"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, #1f7a3a 0%, #14532d 60%, #0d3f22 100%)",
          minHeight,
        }}
      >
        {/* Subtle field lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-white/35" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-10 sm:w-40 sm:h-14 border-2 border-white/35 border-t-0 rounded-b-md" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-10 sm:w-40 sm:h-14 border-2 border-white/35 border-b-0 rounded-t-md" />
        </div>
        <div className={`relative px-3 ${size === "md" ? "py-5 sm:py-7" : "py-3 sm:py-4"} grid grid-cols-3 gap-2 items-start`}>
          {slots.map((s, i) => (
            <PitchSlot key={i} slot={s} onOpen={setOpenSlot} size={size} />
          ))}
        </div>
        {showHint && (
          <div className="relative px-3 pb-3 text-center text-[10px] text-white/75 uppercase tracking-wider">
            Klikni na dres za statistiku
          </div>
        )}
      </div>
      {openSlot && (
        <PlayerDetailModal slot={openSlot} onClose={() => setOpenSlot(null)} />
      )}
    </>
  );
}
