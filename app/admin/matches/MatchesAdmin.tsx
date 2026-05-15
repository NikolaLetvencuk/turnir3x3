"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import { useActionRunner } from "@/components/admin/FormButton";
import { startFirstHalf, finishMatch } from "../actions";
import { formatDateTime } from "@/lib/utils";

type Match = any;

export function MatchesAdmin({ matches }: { matches: Match[] }) {
  const run = useActionRunner();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mečevi</h1>

      <div className="card bg-sky-50 border-sky-200 text-sm text-sky-900 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" />
        <div className="flex-1">
          <p>Mečevi se generišu automatski preko <b>Žreba</b> i <b>Nokaut žreba</b>. Ovde možete da pratite status i otvarate pojedinačne mečeve. Datume i raspored menjate preko <b>Rasporeda</b>.</p>
          <div className="mt-2 flex gap-2 flex-wrap">
            <Link href="/admin/draw" className="btn-secondary !py-1 !px-2 text-xs">Idi na Žreb →</Link>
            <Link href="/admin/schedule" className="btn-secondary !py-1 !px-2 text-xs">Idi na Raspored →</Link>
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-zinc-600 mb-3">Još nema mečeva.</p>
          <p className="text-sm text-zinc-500 mb-4">Pokrenite žreb da generišete grupne mečeve.</p>
          <Link href="/admin/draw" className="btn-primary inline-flex">Pokreni žreb →</Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-zinc-500"><th className="text-left py-2">Kolo</th><th className="text-left">Termin</th><th className="text-left">Meč</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id} className="border-t border-zinc-100">
                  <td className="py-2">{m.round?.name}</td>
                  <td className="text-zinc-500">{formatDateTime(m.kickoff_at)}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      <TeamCrest name={m.home?.name ?? "?"} shortName={m.home?.short_name} primaryColor={m.home?.primary_color} secondaryColor={m.home?.secondary_color} size={20} />
                      {m.home?.name}
                      <b className="tabular-nums mx-1">{m.home_score}:{m.away_score}</b>
                      {m.away?.name}
                      <TeamCrest name={m.away?.name ?? "?"} shortName={m.away?.short_name} primaryColor={m.away?.primary_color} secondaryColor={m.away?.secondary_color} size={20} />
                    </span>
                  </td>
                  <td>
                    {m.status === "live" && <span className="badge-live"><span className="live-dot" />UŽIVO</span>}
                    {m.status === "finished" && <span className="badge-finished">Završeno</span>}
                    {m.status === "scheduled" && <span className="badge-scheduled">Zakazano</span>}
                  </td>
                  <td className="text-right space-x-1">
                    <Link href={`/admin/matches/${m.id}/live`} className="btn-secondary !py-1 !px-2 text-xs">Otvori</Link>
                    {(m.phase === "scheduled" || m.status === "scheduled") && (
                      <form className="inline" onSubmit={async (e) => {
                        e.preventDefault();
                        if (!confirm("Pokrenuti prvo poluvreme? Kolo će biti aktivirano.")) return;
                        const fd = new FormData(); fd.set("id", m.id);
                        await run(startFirstHalf, fd, { successMessage: "Uživo" });
                      }}>
                        <button className="btn-primary !py-1 !px-2 text-xs">Pokreni</button>
                      </form>
                    )}
                    {(m.phase === "second_half" || (m.phase == null && m.status === "live")) && (
                      <form className="inline" onSubmit={async (e) => {
                        e.preventDefault();
                        if (!confirm("Završiti meč?")) return;
                        const fd = new FormData(); fd.set("id", m.id);
                        await run(finishMatch, fd, { successMessage: "Završeno" });
                      }}>
                        <button className="btn-primary !py-1 !px-2 text-xs">Završi</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
