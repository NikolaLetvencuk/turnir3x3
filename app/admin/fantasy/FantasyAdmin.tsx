"use client";

import { Trophy, RefreshCw } from "lucide-react";
import { useActionRunner } from "@/components/admin/FormButton";
import { PageHeader } from "@/components/admin/PageHeader";
import { recalcRound } from "../actions";

type Round = { id: string; name: string; status: string };

export function FantasyAdmin({ rounds }: { rounds: Round[] }) {
  const run = useActionRunner();
  return (
    <div className="space-y-4">
      <PageHeader
        icon={Trophy}
        title="Fantasy"
        hint="Bodovi se obračunavaju automatski. Ovde samo ručno pokrećeš ponovni obračun ako je nešto pogrešno."
        tone="emerald"
      />
      <div className="card">
        <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
          <RefreshCw className="w-4 h-4 text-emerald-600" />
          Ponovo izračunaj bodove po kolu
        </h2>
        <ul className="space-y-1.5">
          {rounds.map((r) => (
            <li key={r.id} className="flex items-center justify-between border-b last:border-0 border-zinc-800 pb-1.5">
              <div>
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{r.status}</div>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(); fd.set("round_id", r.id);
                await run(recalcRound, fd, { successMessage: "Obračunato" });
              }}>
                <button className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-3 py-1.5 text-xs font-medium">
                  <RefreshCw className="w-3.5 h-3.5" /> Izračunaj
                </button>
              </form>
            </li>
          ))}
          {rounds.length === 0 && (
            <li className="text-sm text-zinc-500 italic py-4 text-center">
              Još nema kola. Pokreni žreb prvo.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
