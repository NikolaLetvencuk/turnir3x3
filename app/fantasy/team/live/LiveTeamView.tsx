"use client";

import Link from "next/link";
import { PlayerAvatar } from "@/components/PlayerAvatar";

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
  team_primary: string | null;
  breakdown: Breakdown | null;
  points: number;
} | null;

function StatChip({ label, value, accent }: { label: string; value: number; accent?: "good" | "bad" }) {
  if (!value) return null;
  const cls =
    accent === "good" ? "bg-emerald-50 text-emerald-700"
    : accent === "bad" ? "bg-red-50 text-red-700"
    : "bg-zinc-100 text-zinc-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] ${cls}`}>
      <span className="tabular-nums font-bold">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function SlotCard({ slot }: { slot: PlayerSlot }) {
  if (!slot) {
    return (
      <div className="card text-center text-sm text-zinc-400 italic">
        Prazan slot
      </div>
    );
  }
  const b = slot.breakdown;
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <Link href={`/players/${slot.id}`} className="shrink-0">
          <PlayerAvatar name={slot.name} photoUrl={slot.photo_url} teamPrimary={slot.team_primary} size={48} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/players/${slot.id}`} className="font-semibold truncate hover:text-emerald-700 block">{slot.name}</Link>
          <div className="text-xs text-zinc-500 truncate">{slot.team_name ?? "—"}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold tabular-nums">{slot.points}</div>
          <div className="text-[10px] text-zinc-500">poena</div>
        </div>
      </div>
      {b && (
        <div className="mt-2 flex flex-wrap gap-1">
          <StatChip label="G" value={b.goals} accent="good" />
          <StatChip label="A" value={b.assists} accent="good" />
          <StatChip label="P" value={b.wins} accent="good" />
          <StatChip label="N" value={b.draws} />
          <StatChip label="I" value={b.losses} accent="bad" />
          <StatChip label="CS" value={b.clean_sheets} accent="good" />
          <StatChip label="🟨" value={b.yellow_cards} accent="bad" />
          <StatChip label="🟥" value={b.red_cards} accent="bad" />
          <StatChip label="AG" value={b.own_goals} accent="bad" />
        </div>
      )}
    </div>
  );
}

export function LiveTeamView({ round, slots, total, bank }: {
  round: RoundLite | null;
  slots: PlayerSlot[];
  total: number;
  bank: number | null;
}) {
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
      <div className="card bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-emerald-50/80 uppercase tracking-wide">{round.status === "active" ? "AKTIVNO KOLO" : round.status === "upcoming" ? "SLEDEĆE KOLO" : "POSLEDNJE KOLO"}</div>
            <div className="text-xl font-bold">{round.name}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-emerald-50/80">Bodovi tima</div>
            <div className="text-3xl font-bold tabular-nums">{total}</div>
          </div>
        </div>
        {bank !== null && bank > 0 && (
          <div className="text-xs text-emerald-50/80 mt-2">U banci: <b className="text-white tabular-nums">{Number(bank).toFixed(1)}M</b></div>
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
        <div className="space-y-2">
          {slots.map((s, i) => <SlotCard key={i} slot={s} />)}
        </div>
      )}
    </div>
  );
}
