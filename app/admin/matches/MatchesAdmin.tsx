"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Info, Calendar, X, Lock } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import { useActionRunner } from "@/components/admin/FormButton";
import { setMatchKickoff, startFirstHalf, finishMatch } from "../actions";
import { formatKickoff, toDatetimeLocalValue, toLocalDate } from "@/lib/utils";

type Match = any;
type Round = { id: string; name: string; status: string; display_order: number; stage: string };

function defaultSelectedRound(rounds: Round[], matchesByRound: Map<string, Match[]>): string | null {
  if (rounds.length === 0) return null;
  // Find first round that has at least one non-finished match
  const firstUnfinished = rounds.find((r) => {
    const ms = matchesByRound.get(r.id) ?? [];
    return ms.some((m: any) => m.phase !== "finished" && m.status !== "finished");
  });
  if (firstUnfinished) return firstUnfinished.id;
  // All matches finished: select the last round (final or last knockout)
  return rounds[rounds.length - 1].id;
}

export function MatchesAdmin({ matches, rounds }: { matches: Match[]; rounds: Round[] }) {
  const run = useActionRunner();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>("");

  const matchesByRound = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const key = m.round?.id ?? m.round_id;
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return map;
  }, [matches]);

  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(() => defaultSelectedRound(rounds, matchesByRound));

  // If new data arrives (e.g., after revalidate) and selected became stale, recompute
  useEffect(() => {
    if (selectedRoundId && rounds.find((r) => r.id === selectedRoundId)) return;
    setSelectedRoundId(defaultSelectedRound(rounds, matchesByRound));
  }, [rounds, matchesByRound, selectedRoundId]);

  const selectedMatches = selectedRoundId ? matchesByRound.get(selectedRoundId) ?? [] : [];
  const datesInSelected = useMemo(() => {
    const set = new Set<string>();
    for (const m of selectedMatches) {
      const d = toLocalDate(m.kickoff_at);
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [selectedMatches]);
  const filtered = useMemo(() => {
    if (!dateFilter) return selectedMatches;
    if (dateFilter === "__none__") return selectedMatches.filter((m: any) => !m.kickoff_at);
    return selectedMatches.filter((m: any) => toLocalDate(m.kickoff_at) === dateFilter);
  }, [selectedMatches, dateFilter]);

  // Clear date filter when switching rounds
  useEffect(() => { setDateFilter(""); }, [selectedRoundId]);

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

      {matches.length === 0 || rounds.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-zinc-600 mb-3">Još nema mečeva.</p>
          <p className="text-sm text-zinc-500 mb-4">Pokrenite žreb da generišete grupne mečeve.</p>
          <Link href="/admin/draw" className="btn-primary inline-flex">Pokreni žreb →</Link>
        </div>
      ) : (
        <>
          <div className="card !p-2 overflow-x-auto">
            <div className="flex gap-1 whitespace-nowrap">
              {rounds.map((r) => {
                const count = matchesByRound.get(r.id)?.length ?? 0;
                const finished = (matchesByRound.get(r.id) ?? []).every((m: any) => m.phase === "finished" || m.status === "finished") && count > 0;
                const active = selectedRoundId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoundId(r.id)}
                    className={`px-3 py-1.5 rounded-md text-sm inline-flex items-center gap-1.5 transition ${
                      active
                        ? "bg-emerald-600 text-white"
                        : finished
                        ? "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                        : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
                    }`}
                  >
                    {finished && <Lock className="w-3 h-3" />}
                    {r.name}
                    <span className={`text-xs ${active ? "text-emerald-100" : "text-zinc-400"}`}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {datesInSelected.length > 1 && (
            <div className="card flex flex-wrap items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-600">Filter po danu:</span>
              <select className="input !py-1 !w-auto" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                <option value="">Svi dani ({selectedMatches.length})</option>
                {datesInSelected.map((d) => {
                  const c = selectedMatches.filter((m: any) => toLocalDate(m.kickoff_at) === d).length;
                  return <option key={d} value={d}>{d} ({c})</option>;
                })}
                {selectedMatches.some((m: any) => !m.kickoff_at) && (
                  <option value="__none__">Bez termina ({selectedMatches.filter((m: any) => !m.kickoff_at).length})</option>
                )}
              </select>
              {dateFilter && (
                <button onClick={() => setDateFilter("")} className="btn-secondary !py-1 !px-2 text-xs inline-flex items-center gap-1">
                  <X className="w-3 h-3" /> Poništi
                </button>
              )}
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500">
                  <th className="text-left py-2">Termin</th>
                  <th className="text-left">Meč</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: any) => (
                  <tr key={m.id} className="border-t border-zinc-100">
                    <td className="text-zinc-600 min-w-[240px] py-2">
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
                          className="text-left hover:text-emerald-700"
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
                  <tr><td colSpan={4} className="py-4 text-center text-zinc-500">Nema mečeva u izabranom kolu.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
