"use client";

import { useState } from "react";
import Link from "next/link";
import { Jersey } from "@/components/fantasy/PitchTeam";

export type DaySlot = {
  id: string;
  name: string;
  photo_url: string | null;
  team_short: string | null;
  team_name: string | null;
  team_primary: string | null;
  played: boolean;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  own: number;
  won: boolean;
  drew: boolean;
  clean: boolean;
  points: number;
};

export type DayEntry = {
  day: string;
  slots: DaySlot[];
  total: number;
};

const SR_MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
function formatSrDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d}. ${SR_MONTHS[m - 1] ?? m}.`;
}

export function HistoryView({ days, grandTotal }: { days: DayEntry[]; grandTotal: number }) {
  const [open, setOpen] = useState<DaySlot | null>(null);

  return (
    <div className="space-y-4">
      <div className="card flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pregled poena</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Tvoj tim i poeni za svaki odigrani dan.</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-zinc-500">Ukupno</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-300">{grandTotal}</div>
        </div>
      </div>

      {days.length === 0 && (
        <p className="text-sm text-zinc-500">
          Još nemaš sačuvane timove. Idi na{" "}
          <Link href="/fantasy/team" className="text-blue-300 underline">Sastavi tim</Link>.
        </p>
      )}

      {days.map((d) => (
        <div key={d.day} className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
            <h2 className="font-medium text-sm">{formatSrDate(d.day)}</h2>
            <div className="text-sm">
              <span className="text-zinc-500 text-xs mr-1">poena</span>
              <span className="font-bold tabular-nums text-emerald-300">{d.total}</span>
            </div>
          </div>
          <div
            className="relative"
            style={{
              background: "radial-gradient(120% 80% at 50% 0%, #1f7a3a 0%, #14532d 60%, #0d3f22 100%)",
            }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-white/30" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/25" />
            </div>
            <div className="relative grid grid-cols-3 gap-1.5 px-2 py-4">
              {d.slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setOpen(s)}
                  className="flex flex-col items-center text-center"
                >
                  <Jersey primary={s.team_primary || "#1f2937"} shortName={s.team_short} size={64} />
                  <div className="mt-1 bg-white/95 text-zinc-900 rounded-md px-2 py-0.5 text-[11px] font-bold max-w-[90px] truncate">
                    {s.name.split(/\s+/).slice(-1)[0] ?? s.name}
                  </div>
                  <div
                    className={`mt-1 rounded-md px-2 py-0.5 text-xs font-black tabular-nums ${
                      !s.played
                        ? "bg-red-500/25 text-red-100 border border-red-400/50"
                        : s.points > 0
                        ? "bg-emerald-500/25 text-emerald-100 border border-emerald-400/50"
                        : "bg-zinc-900/80 text-zinc-200"
                    }`}
                  >
                    {s.played ? s.points : "—"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      {open && <SlotDetailModal slot={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SlotDetailModal({ slot, onClose }: { slot: DaySlot; onClose: () => void }) {
  const lines: Array<[string, number, number]> = [
    ["Gol", slot.goals, 3],
    ["Asistencija", slot.assists, 2],
    ["Pobeda", slot.won ? 1 : 0, 1],
    ["Čista mreža", slot.clean ? 1 : 0, 1],
    ["Žuti karton", slot.yellow, -1],
    ["Crveni karton", slot.red, -2],
    ["Autogol", slot.own, -1],
  ];
  const active = lines.filter(([, c]) => c > 0);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div className="bg-zinc-900 rounded-xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <Jersey primary={slot.team_primary || "#1f2937"} shortName={slot.team_short} size={56} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{slot.name}</div>
            <div className="text-xs text-zinc-500 truncate">{slot.team_name ?? "—"}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums text-emerald-300">{slot.played ? slot.points : "—"}</div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-300 text-2xl leading-none ml-1" aria-label="Zatvori">
            ×
          </button>
        </div>

        {!slot.played ? (
          <div className="card border-red-500/30 bg-red-500/[0.06] text-sm text-red-200 !p-3">
            Tim ovog igrača nije igrao taj dan — bez bodova.
          </div>
        ) : active.length === 0 ? (
          <div className="card !p-3 text-sm text-zinc-400 text-center">
            Igrač je igrao ali nije imao događaje koji nose bodove.
          </div>
        ) : (
          <ul className="card !p-0 overflow-hidden divide-y divide-zinc-800">
            {active.map(([label, count, per]) => (
              <li key={label} className="px-3 py-2 flex items-center gap-2 text-sm">
                <span className="bg-zinc-800 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums shrink-0">{count}×</span>
                <span className="flex-1 truncate">{label}</span>
                <span
                  className={`tabular-nums font-bold w-12 text-right ${
                    count * per >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {count * per > 0 ? `+${count * per}` : count * per}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Link href={`/players/${slot.id}`} className="btn-secondary w-full text-center text-sm mt-3 inline-block">
          Ceo profil →
        </Link>
      </div>
    </div>
  );
}
