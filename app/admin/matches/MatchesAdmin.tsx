"use client";

import Link from "next/link";
import { useActionRunner } from "@/components/admin/FormButton";
import { createMatch, deleteMatch, startMatch, finishMatch } from "../actions";
import { formatDateTime } from "@/lib/utils";

type Team = { id: string; name: string };
type Round = { id: string; name: string; stage: string };
type Group = { id: string; name: string };
type Match = any;

export function MatchesAdmin({ matches, teams, rounds, groups }: { matches: Match[]; teams: Team[]; rounds: Round[]; groups: Group[] }) {
  const run = useActionRunner();

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const ok = await run(createMatch, fd);
    if (ok) e.currentTarget.reset();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mečevi</h1>
      <form onSubmit={onCreate} className="card grid sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-2">
        <select name="round_id" required className="input">
          <option value="">Kolo</option>
          {rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select name="group_id" className="input">
          <option value="">Grupa (opciono)</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select name="home_team_id" required className="input">
          <option value="">Domaćin</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select name="away_team_id" required className="input">
          <option value="">Gost</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input name="kickoff_at" type="datetime-local" className="input" />
        <button className="btn-primary">Dodaj</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-zinc-500"><th className="text-left py-2">Kolo</th><th className="text-left">Termin</th><th className="text-left">Meč</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id} className="border-t border-zinc-100">
                <td className="py-2">{m.round?.name}</td>
                <td className="text-zinc-500">{formatDateTime(m.kickoff_at)}</td>
                <td>{m.home?.name} <b className="tabular-nums">{m.home_score}:{m.away_score}</b> {m.away?.name}</td>
                <td>
                  {m.status === "live" && <span className="badge-live"><span className="live-dot" />UŽIVO</span>}
                  {m.status === "finished" && <span className="badge-finished">Završeno</span>}
                  {m.status === "scheduled" && <span className="badge-scheduled">Zakazano</span>}
                </td>
                <td className="text-right space-x-1">
                  <Link href={`/admin/matches/${m.id}/live`} className="btn-secondary !py-1 !px-2 text-xs">Otvori</Link>
                  {m.status === "scheduled" && (
                    <form className="inline" onSubmit={async (e) => {
                      e.preventDefault();
                      if (!confirm("Pokrenuti meč uživo? Kolo će biti aktivirano.")) return;
                      const fd = new FormData(); fd.set("id", m.id);
                      await run(startMatch, fd, { successMessage: "Uživo" });
                    }}>
                      <button className="btn-primary !py-1 !px-2 text-xs">Go Live</button>
                    </form>
                  )}
                  {m.status === "live" && (
                    <form className="inline" onSubmit={async (e) => {
                      e.preventDefault();
                      if (!confirm("Završiti meč?")) return;
                      const fd = new FormData(); fd.set("id", m.id);
                      await run(finishMatch, fd, { successMessage: "Završeno" });
                    }}>
                      <button className="btn-primary !py-1 !px-2 text-xs">Završi</button>
                    </form>
                  )}
                  <form className="inline" onSubmit={async (e) => {
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
            {matches.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-zinc-500">Nema mečeva.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
