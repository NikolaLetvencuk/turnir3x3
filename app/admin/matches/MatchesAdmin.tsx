"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Info, Calendar, X, Lock, Zap } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import { LiveRefresh } from "@/components/LiveRefresh";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useActionRunner } from "@/components/admin/FormButton";
import { setMatchKickoff, startFirstHalf, finishMatch, bulkSetMatchKickoffs } from "../actions";
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
  const router = useRouter();
  const { push } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStart, setBulkStart] = useState<string>("");
  const [bulkGap, setBulkGap] = useState<number>(40);
  const [bulkBusy, setBulkBusy] = useState(false);

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

  function openBulk() {
    const firstWithKickoff = selectedMatches.find((m: any) => m.kickoff_at);
    setBulkStart(firstWithKickoff ? toDatetimeLocalValue(firstWithKickoff.kickoff_at) : "");
    setBulkOpen(true);
  }

  async function runBulkFill() {
    if (!bulkStart.trim() || !Number.isFinite(bulkGap) || bulkGap < 0) return;
    const hasExisting = selectedMatches.some((m: any) => m.kickoff_at);
    if (hasExisting && !confirm("Postojeći termini u ovom kolu će biti prepisani. Nastaviti?")) return;
    setBulkBusy(true);
    const res = await bulkSetMatchKickoffs({
      ordered_match_ids: selectedMatches.map((m: any) => m.id),
      start: bulkStart,
      gap_minutes: bulkGap,
    });
    setBulkBusy(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push(`Popunjeno ${selectedMatches.length} termina`, "success");
    setBulkOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <LiveRefresh tag="admin-matches" />
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
                        ? "bg-blue-600 text-white"
                        : finished
                        ? "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                        : "bg-white text-zinc-700 hover:bg-zinc-100 border border-zinc-200"
                    }`}
                  >
                    {finished && <Lock className="w-3 h-3" />}
                    {r.name}
                    <span className={`text-xs ${active ? "text-blue-100" : "text-zinc-400"}`}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedMatches.length > 0 && (
            <div className="card flex flex-wrap items-center gap-2 text-sm">
              <button
                onClick={openBulk}
                className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
                title="Automatski popuni termine za sve mečeve ovog kola"
              >
                <Zap className="w-3.5 h-3.5" />
                Popuni termine
              </button>
              <span className="text-xs text-zinc-500">
                Auto-popunjava {selectedMatches.length} mečeva u kolu sekvencijalno (početak + razmak).
              </span>
            </div>
          )}

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
                          className="text-left hover:text-blue-700"
                        >
                          {m.kickoff_at ? formatKickoff(m.kickoff_at) : <span className="text-zinc-400 italic">+ dodaj termin</span>}
                        </button>
                      )}
                    </td>
                    <td className="min-w-0">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TeamCrest name={m.home?.name ?? "?"} shortName={m.home?.short_name} primaryColor={m.home?.primary_color} secondaryColor={m.home?.secondary_color} size={18} />
                          <span className="truncate flex-1">{m.home?.name}</span>
                          <b className="tabular-nums shrink-0">{m.home_score}</b>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TeamCrest name={m.away?.name ?? "?"} shortName={m.away?.short_name} primaryColor={m.away?.primary_color} secondaryColor={m.away?.secondary_color} size={18} />
                          <span className="truncate flex-1">{m.away?.name}</span>
                          <b className="tabular-nums shrink-0">{m.away_score}</b>
                        </div>
                      </div>
                    </td>
                    <td>
                      {m.status === "live" && <span className="badge-live"><span className="live-dot" />UŽIVO</span>}
                      {m.status === "finished" && <span className="badge-finished">Završeno</span>}
                      {m.status === "scheduled" && <span className="badge-scheduled">Zakazano</span>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="inline-flex flex-col sm:flex-row items-end sm:items-center gap-1">
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
                      </div>
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

      {bulkOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !bulkBusy && setBulkOpen(false)}>
          <div className="bg-white rounded-xl p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" /> Popuni termine za kolo
            </h3>
            <p className="text-sm text-zinc-600 mb-3">
              Automatski postavlja termine za <b>{selectedMatches.length} mečeva</b>. Prvi meč počinje u izabrano vreme,
              svaki sledeći pomeren za izabrani razmak.
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="label">Početak prvog meča</span>
                <input
                  type="datetime-local"
                  className="input"
                  value={bulkStart}
                  onChange={(e) => setBulkStart(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="label">Razmak između mečeva (minuta)</span>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  step={5}
                  className="input"
                  value={bulkGap}
                  onChange={(e) => setBulkGap(Number(e.target.value) || 0)}
                />
              </label>

              {bulkStart && Number.isFinite(bulkGap) && bulkGap >= 0 && selectedMatches.length > 0 && (
                <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-md p-2 max-h-40 overflow-y-auto">
                  <div className="font-medium text-zinc-700 mb-1">Pregled:</div>
                  {selectedMatches.slice(0, 8).map((m: any, i: number) => {
                    const start = new Date(bulkStart);
                    if (isNaN(start.getTime())) return null;
                    const t = new Date(start.getTime() + i * bulkGap * 60000);
                    const hh = String(t.getHours()).padStart(2, "0");
                    const mm = String(t.getMinutes()).padStart(2, "0");
                    return (
                      <div key={m.id} className="truncate">
                        <span className="tabular-nums text-zinc-500">{hh}:{mm}</span> — {m.home?.name} vs {m.away?.name}
                      </div>
                    );
                  })}
                  {selectedMatches.length > 8 && <div className="text-zinc-400 mt-0.5">… i još {selectedMatches.length - 8}</div>}
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setBulkOpen(false)} disabled={bulkBusy} className="btn-secondary">Otkaži</button>
              <button onClick={runBulkFill} disabled={bulkBusy || !bulkStart} className="btn-primary">
                {bulkBusy ? "Popunjavam…" : "Popuni"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
