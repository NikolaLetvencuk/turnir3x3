"use client";

import { useState } from "react";
import Link from "next/link";

export type RoundLite = { id: string; name: string; status: string; display_order: number };

type Breakdown = {
  goals: number; assists: number;
  wins: number; draws: number; losses: number;
  clean_sheets: number;
  yellow_cards: number; red_cards: number; own_goals: number;
};

export type PlayerSlot = {
  id: string;
  name: string;
  photo_url: string | null;
  team_name: string | null;
  team_short: string | null;
  team_primary: string | null;
  team_secondary: string | null;
  breakdown: Breakdown | null;
  points: number;
  yet_to_play: boolean;
} | null;

function StatChip({ label, value, accent }: { label: string; value: number; accent?: "good" | "bad" }) {
  if (!value) return null;
  const cls =
    accent === "good" ? "bg-blue-50 text-blue-700"
    : accent === "bad" ? "bg-red-50 text-red-700"
    : "bg-zinc-100 text-zinc-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${cls}`}>
      <span className="tabular-nums font-bold">{value}</span>
      <span>{label}</span>
    </span>
  );
}

/* SVG football jersey filled with team primary, sleeves in secondary if provided. */
function Jersey({
  primary,
  secondary,
  shortName,
  size = 84,
}: {
  primary: string;
  secondary: string | null;
  shortName?: string | null;
  size?: number;
}) {
  const sleeve = secondary && secondary !== primary ? secondary : darken(primary, 0.2);
  const textColor = luminance(primary) > 0.6 ? "#1f2937" : "#ffffff";
  return (
    <svg width={size} height={Math.round(size * 1.05)} viewBox="0 0 100 105" aria-hidden>
      {/* Body */}
      <path
        d="M30 14 L20 8 L4 18 L12 38 L24 32 L24 96 Q24 100 28 100 L72 100 Q76 100 76 96 L76 32 L88 38 L96 18 L80 8 L70 14 Q60 22 50 22 Q40 22 30 14 Z"
        fill={primary}
        stroke="rgba(0,0,0,0.45)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* Sleeves overlay (cuffs) */}
      <path d="M4 18 L12 38 L20 33 L13 14 Z" fill={sleeve} stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M96 18 L88 38 L80 33 L87 14 Z" fill={sleeve} stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" strokeLinejoin="round" />
      {/* Neck v */}
      <path d="M40 18 Q50 26 60 18 L58 22 Q50 28 42 22 Z" fill="rgba(0,0,0,0.25)" />
      {/* Short name (optional) */}
      {shortName && (
        <text
          x="50"
          y="68"
          textAnchor="middle"
          fontSize="22"
          fontWeight="900"
          fill={textColor}
          fontFamily="Inter, sans-serif"
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

function PitchSlot({ slot, onOpen }: { slot: PlayerSlot; onOpen: (slot: NonNullable<PlayerSlot>) => void }) {
  if (!slot) {
    return (
      <div className="flex flex-col items-center justify-center text-white/70 text-xs h-full">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 inline-flex items-center justify-center text-2xl">+</div>
        <div className="mt-2 italic">Prazan slot</div>
      </div>
    );
  }
  const lastName = slot.name.split(/\s+/).slice(-1)[0] || slot.name;
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
        size={88}
      />
      <div className="mt-1.5 bg-white/95 text-zinc-900 rounded-md px-2 py-0.5 text-xs font-bold max-w-[110px] truncate">
        {lastName}
      </div>
      <div
        className={`mt-1 rounded-md px-2 py-1 text-sm font-black tabular-nums shadow-sm ${
          slot.yet_to_play
            ? "bg-amber-100 text-amber-800 border border-amber-300"
            : "bg-blue-600 text-white"
        }`}
      >
        {slot.yet_to_play ? "—" : slot.points}
      </div>
      {slot.yet_to_play && (
        <div className="mt-1 text-[10px] text-white/85 uppercase tracking-wider font-semibold">
          Tek igra
        </div>
      )}
    </button>
  );
}

function PlayerDetailModal({ slot, onClose }: { slot: NonNullable<PlayerSlot>; onClose: () => void }) {
  const b = slot.breakdown;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={onClose}>
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
          <div className="card border-amber-300 bg-amber-50 text-amber-900 text-sm">
            Igrač tek treba da odigra meč u ovom kolu — zato bodova još nema.
          </div>
        ) : (
          <>
            <div className="card !p-3 text-center mb-3">
              <div className="text-xs text-zinc-500">Bodovi u ovom kolu</div>
              <div className="text-4xl font-black tabular-nums">{slot.points}</div>
            </div>
            {b && (
              <div className="flex flex-wrap gap-1.5">
                <StatChip label="gol" value={b.goals} accent="good" />
                <StatChip label="asist" value={b.assists} accent="good" />
                <StatChip label="pobeda" value={b.wins} accent="good" />
                <StatChip label="nerešeno" value={b.draws} />
                <StatChip label="poraz" value={b.losses} accent="bad" />
                <StatChip label="čista mreža" value={b.clean_sheets} accent="good" />
                <StatChip label="🟨" value={b.yellow_cards} accent="bad" />
                <StatChip label="🟥" value={b.red_cards} accent="bad" />
                <StatChip label="autogol" value={b.own_goals} accent="bad" />
              </div>
            )}
          </>
        )}

        <Link
          href={`/players/${slot.id}`}
          className="btn-secondary w-full text-center text-sm mt-3 inline-block"
        >
          Cela statistika i istorija →
        </Link>
      </div>
    </div>
  );
}

export function LiveTeamView({ round, slots, total, bank }: {
  round: RoundLite | null;
  slots: PlayerSlot[];
  total: number;
  bank: number | null;
}) {
  const [openSlot, setOpenSlot] = useState<NonNullable<PlayerSlot> | null>(null);

  if (!round) {
    return (
      <div className="card text-center text-sm text-zinc-500">
        Nema aktivnog ni odigranog kola.
      </div>
    );
  }
  const allEmpty = slots.every((s) => s === null);
  return (
    <div className="space-y-3">
      <div className="card bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-blue-50/80 uppercase tracking-wide">
              {round.status === "active" ? "AKTIVNO KOLO" : round.status === "upcoming" ? "SLEDEĆE KOLO" : "POSLEDNJE KOLO"}
            </div>
            <div className="text-xl font-bold">{round.name}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-blue-50/80">Bodovi tima</div>
            <div className="text-3xl font-bold tabular-nums">{total}</div>
          </div>
        </div>
        {bank !== null && bank > 0 && (
          <div className="text-xs text-blue-50/80 mt-2">U banci: <b className="text-white tabular-nums">{Number(bank).toFixed(1)}M</b></div>
        )}
      </div>

      {allEmpty ? (
        <div className="card text-center">
          <p className="text-zinc-600 text-sm">
            {round.status === "upcoming"
              ? "Nisi lockovao tim za ovo kolo. Tim iz prošlog kola će biti automatski korišćen."
              : "Nisi imao tim u ovom kolu."}
          </p>
          {round.status === "upcoming" && (
            <Link href="/fantasy/team" className="btn-primary inline-flex mt-3">Sastavi tim →</Link>
          )}
        </div>
      ) : (
        <div
          className="relative rounded-2xl overflow-hidden border border-emerald-300 shadow-inner"
          style={{
            background:
              "repeating-linear-gradient(90deg, #16a34a 0, #16a34a 60px, #15803d 60px, #15803d 120px)",
            minHeight: 280,
          }}
        >
          {/* Center circle + line */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-white/60" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/60" />
            <div className="absolute inset-x-0 top-2 mx-auto w-32 h-12 border-2 border-white/60 border-t-0" />
            <div className="absolute inset-x-0 bottom-2 mx-auto w-32 h-12 border-2 border-white/60 border-b-0" />
          </div>
          <div className="relative px-3 py-4 sm:py-6 grid grid-cols-3 gap-2 items-start">
            {slots.map((s, i) => (
              <PitchSlot key={i} slot={s} onOpen={setOpenSlot} />
            ))}
          </div>
          <div className="relative px-3 pb-3 text-center text-[10px] text-white/80 uppercase tracking-wider">
            Klikni na dres da vidiš statistiku igrača
          </div>
        </div>
      )}

      {openSlot && <PlayerDetailModal slot={openSlot} onClose={() => setOpenSlot(null)} />}
    </div>
  );
}
