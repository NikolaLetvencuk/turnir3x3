"use client";

import { useActionRunner } from "@/components/admin/FormButton";
import { createMatch, deleteMatch } from "../actions";
import { formatDateTime } from "@/lib/utils";

type Round = { id: string; name: string };
type Team = { id: string; name: string };
type Match = any;

export function BracketAdmin({ rounds, teams, matches }: { rounds: Round[]; teams: Team[]; matches: Match[] }) {
  const run = useActionRunner();

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await run(createMatch, fd);
    if (ok) e.currentTarget.reset();
  }

  if (rounds.length === 0) {
    return (
      <div className="card text-sm">
        Prvo dodaj kola sa fazom „Eliminacije“ u sekciji <a href="/admin/rounds" className="text-emerald-700 underline">Kola</a>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Eliminaciona faza</h1>
      <form onSubmit={onAdd} className="card grid sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-2">
        <select name="round_id" required className="input">
          <option value="">Kolo</option>
          {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select name="home_team_id" required className="input">
          <option value="">Domaćin</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select name="away_team_id" required className="input">
          <option value="">Gost</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input name="bracket_position" placeholder="Pozicija (npr. QF1)" className="input" />
        <input name="kickoff_at" type="datetime-local" className="input" />
        <button className="btn-primary">Dodaj</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-zinc-500"><th className="text-left py-2">Kolo</th><th className="text-left">Pozicija</th><th className="text-left">Meč</th><th>Termin</th><th></th></tr></thead>
          <tbody>
            {matches.map((m: any) => (
              <tr key={m.id} className="border-t border-zinc-100">
                <td className="py-2">{m.round?.name}</td>
                <td>{m.bracket_position ?? "—"}</td>
                <td>{m.home?.name} {m.home_score}:{m.away_score} {m.away?.name}</td>
                <td className="text-zinc-500">{formatDateTime(m.kickoff_at)}</td>
                <td className="text-right">
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!confirm("Obrisati meč?")) return;
                    const fd = new FormData(); fd.set("id", m.id);
                    await run(deleteMatch, fd, { successMessage: "Obrisano" });
                  }}>
                    <button className="btn-danger !py-1 !px-2 text-xs">Obriši</button>
                  </form>
                </td>
              </tr>
            ))}
            {matches.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-zinc-500">Nema eliminacionih mečeva.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
