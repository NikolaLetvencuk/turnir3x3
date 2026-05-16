"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Info, Calendar, X } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import { useActionRunner } from "@/components/admin/FormButton";
import { setMatchKickoff, startFirstHalf, finishMatch } from "../actions";
import { formatKickoff, toDatetimeLocalValue, toLocalDate } from "@/lib/utils";

type Match = any;

export function MatchesAdmin({ matches }: { matches: Match[] }) {
  const run = useActionRunner();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>("");

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      const d = toLocalDate(m.kickoff_at);
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [matches]);

  const filtered = useMemo(() => {
    if (!dateFilter) return matches;
    if (dateFilter === "__none__") return matches.filter((m: any) => !m.kickoff_at);
    return matches.filter((m: any) => toLocalDate(m.kickoff_at) === dateFilter);
  }, [matches, dateFilter]);

  async function saveKickoff(id: string, value: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("kickoff_at", value);
    const ok = await run(setMatchKickoff, fd, { successMessage: value ? "Termin sačuvan" : "Termin obrisan" });
    if (ok) setEditingId(null);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mečevi</h1>

      <div className="card bg-sky-50 border-sky-200 text-sm text-sky-900 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" />
        <div className="flex-1">
          <p>Mečevi se generišu automatski preko <b>Žreba</b> i <b>Nokaut žreba</b>. Ovde možeš da dodaš termin svakom meču i otvaraš pojedinačne mečeve. Raspored kola menjaš preko <b>Rasporeda</b>.</p>
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
        <>
          <div className="card flex flex-wrap items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <span className="text-zinc-600">Filter po datumu:</span>
            <select className="input !py-1 !w-auto" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              <option value="">Svi datumi ({matches.length})</option>
              {availableDates.map((d) => {
                const count = matches.filter((m: any) => toLocalDate(m.kickoff_at) === d).length;
                return <option key={d} value={d}>{d} ({count})</option>;
              })}
              <option value="__none__">Bez termina ({matches.filter((m: any) => !m.kickoff_at).length})</option>
            </select>
            {dateFilter && (
              <button onClick={() => setDateFilter("")} className="btn-secondary !py-1 !px-2 text-xs inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Poništi
              </button>
            )}
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500">
                  <th className="text-left py-2">Kolo</th>
                  <th className="text-left">Termin</th>
                  <th className="text-left">Meč</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: any) => (
                  <tr key={m.id} className="border-t border-zinc-100">
                    <td className="py-2 whitespace-nowrap">{m.round?.name}</td>
                    <td className="text-zinc-600 min-w-[240px]">
                      {editingId === m.id ? (
                        <form
                          className="flex items-center gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            saveKickoff(m.id, String(fd.get("kickoff_at") ?? ""));
                          }}
                        >
                          <input
                            name="kickoff_at"
                            type="datetime-local"
                            defaultValue={toDatetimeLocalValue(m.kickoff_at)}
                            className="input !py-1 !text-xs"
                            autoFocus
                          />
                          <button className="btn-primary !py-1 !px-2 text-xs">Sačuvaj</button>
                          <button type="button" onClick={() => setEditingId(null)} className="btn-secondary !py-1 !px-2 text-xs">Otkaži</button>
                          {m.kickoff_at && (
                            <button
                              type="button"
                              onClick={() => saveKickoff(m.id, "")}
                              className="btn-danger !py-1 !px-2 text-xs"
                              title="Obriši termin"
                            >Obriši</button>
                          )}
                        </form>
                      ) : (
                        <button
                          onClick={() => setEditingId(m.id)}
                          className="text-left hover:text-emerald-700 inline-flex items-center gap-1"
                        >
                          {m.kickoff_at ? formatKickoff(m.kickoff_at) : <span className="text-zinc-400 italic">+ dodaj termin</span>}
                        </button>
                      )}
                    </td>
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
                    <td className="text-right space-x-1 whitespace-nowrap">
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
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-zinc-500">Nema mečeva za izabrani datum.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
