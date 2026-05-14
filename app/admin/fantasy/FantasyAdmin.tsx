"use client";

import { useActionRunner } from "@/components/admin/FormButton";
import { recalcRound } from "../actions";

type Round = { id: string; name: string; status: string };

export function FantasyAdmin({ rounds }: { rounds: Round[] }) {
  const run = useActionRunner();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Fantasy administracija</h1>
      <div className="card">
        <h2 className="font-medium mb-2">Ručni obračun bodova</h2>
        <p className="text-sm text-zinc-600 mb-3">Obračun se odvija automatski kod izmena događaja i kraja kola. Ovde možeš ručno pokrenuti recompute za neko kolo.</p>
        <ul className="space-y-2">
          {rounds.map((r) => (
            <li key={r.id} className="flex items-center justify-between border-b last:border-0 border-zinc-100 pb-2">
              <span>{r.name} · <span className="text-zinc-500 text-xs">{r.status}</span></span>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(); fd.set("round_id", r.id);
                await run(recalcRound, fd, { successMessage: "Obračun izvršen" });
              }}>
                <button className="btn-secondary !py-1 !px-3 text-xs">Recompute</button>
              </form>
            </li>
          ))}
          {rounds.length === 0 && <p className="text-sm text-zinc-500">Nema kola.</p>}
        </ul>
      </div>
    </div>
  );
}
