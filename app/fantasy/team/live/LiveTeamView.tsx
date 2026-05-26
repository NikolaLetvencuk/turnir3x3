"use client";

import Link from "next/link";
import { PitchTeam, type PitchPlayerSlot } from "@/components/fantasy/PitchTeam";

export type RoundLite = { id: string; name: string; status: string; display_order: number };

export type PlayerSlot = PitchPlayerSlot;

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
          <p className="text-zinc-400 text-sm">
            {round.status === "upcoming"
              ? "Nisi lockovao tim za ovo kolo. Tim iz prošlog kola će biti automatski korišćen."
              : "Nisi imao tim u ovom kolu."}
          </p>
          {round.status === "upcoming" && (
            <Link href="/fantasy/team" className="btn-primary inline-flex mt-3">Sastavi tim →</Link>
          )}
        </div>
      ) : (
        <PitchTeam slots={slots} size="md" />
      )}
    </div>
  );
}
