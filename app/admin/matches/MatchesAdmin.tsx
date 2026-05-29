"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Calendar, X, Lock, Zap, ListChecks, CalendarClock, Trash2, Plus } from "lucide-react";
import { TeamCrest } from "@/components/TeamCrest";
import { LiveRefresh } from "@/components/LiveRefresh";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useActionRunner } from "@/components/admin/FormButton";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  setMatchKickoff,
  startFirstHalf,
  finishMatch,
  bulkSetMatchKickoffs,
  bulkAutoFillKickoffs,
  shiftScheduleFromDate,
} from "../actions";
import { formatKickoff, toDatetimeLocalValue, toLocalDate } from "@/lib/utils";
import { ScheduleBoard } from "../schedule/ScheduleBoard";

type Match = any;
type Round = { id: string; name: string; status: string; display_order: number; stage: string };
type ScheduleMatch = {
  id: string;
  round_id: string;
  status: string;
  phase: string | null;
  kickoff_at: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home: any;
  away: any;
};

function defaultSelectedRound(rounds: Round[], matchesByRound: Map<string, Match[]>): string | null {
  if (rounds.length === 0) return null;
  const firstUnfinished = rounds.find((r) => {
    const ms = matchesByRound.get(r.id) ?? [];
    return ms.some((m: any) => m.phase !== "finished" && m.status !== "finished");
  });
  if (firstUnfinished) return firstUnfinished.id;
  return rounds[rounds.length - 1].id;
}

type Tab = "matches" | "schedule";

export function MatchesAdmin({
  matches,
  rounds,
  scheduleMatches,
}: {
  matches: Match[];
  rounds: Round[];
  scheduleMatches: ScheduleMatch[];
}) {
  const [tab, setTab] = useState<Tab>("matches");

  return (
    <div className="space-y-4">
      <LiveRefresh tag="admin-matches" />
      <PageHeader
        icon={ListChecks}
        title="Mečevi"
        hint="Postavi termine, pokreni mečeve i unosi golove. Sa kartice Raspored prevlačiš mečeve između kola."
        tone="purple"
      />

      {/* Sub-tabs */}
      <div className="card !p-0 overflow-hidden flex">
        {[
          { key: "matches" as const, label: "Mečevi", icon: ListChecks },
          { key: "schedule" as const, label: "Raspored", icon: CalendarClock },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-medium transition ${
              tab === key ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/60"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "matches" ? (
        <MatchesTab matches={matches} rounds={rounds} />
      ) : (
        <ScheduleBoard rounds={rounds as any[]} matches={scheduleMatches as any[]} />
      )}
    </div>
  );
}

function MatchesTab({ matches, rounds }: { matches: Match[]; rounds: Round[] }) {
  const run = useActionRunner();
  const router = useRouter();
  const { push } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  // Default the date filter to today (or the next day with matches). If no
  // match has a kickoff set yet, fall back to "Svi dani" ("").
  const initialDateFilter = useMemo(() => {
    const dated = matches.map((m: any) => toLocalDate(m.kickoff_at)).filter(Boolean) as string[];
    if (dated.length === 0) return "";
    const todayKey = toLocalDate(new Date().toISOString());
    if (todayKey && dated.includes(todayKey)) return todayKey;
    const future = dated.filter((d) => todayKey && d >= todayKey).sort();
    return future[0] ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [dateFilter, setDateFilter] = useState<string>(initialDateFilter);
  const dateFilterTouched = useRef(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStart, setBulkStart] = useState<string>("");
  const [bulkGap, setBulkGap] = useState<number>(40);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [autoFillOpen, setAutoFillOpen] = useState(false);

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

  // "__all__" = show every match across all rounds (default).
  const ALL = "__all__";
  const [selectedRoundId, setSelectedRoundId] = useState<string>(ALL);

  useEffect(() => {
    if (selectedRoundId === ALL) return;
    if (rounds.find((r) => r.id === selectedRoundId)) return;
    setSelectedRoundId(ALL);
  }, [rounds, selectedRoundId]);

  // Always sort by kickoff date+time (earliest first); matches without a
  // kickoff set go to the bottom.
  function byKickoff(a: any, b: any) {
    const ak = a.kickoff_at ?? "";
    const bk = b.kickoff_at ?? "";
    if (!ak && !bk) return 0;
    if (!ak) return 1;
    if (!bk) return -1;
    return ak.localeCompare(bk);
  }

  const selectedMatchesRaw =
    selectedRoundId === ALL ? matches : matchesByRound.get(selectedRoundId) ?? [];
  const selectedMatches = useMemo(
    () => [...selectedMatchesRaw].sort(byKickoff),
    [selectedMatchesRaw],
  );
  const datesInSelected = useMemo(() => {
    const set = new Set<string>();
    for (const m of selectedMatches) {
      const d = toLocalDate(m.kickoff_at);
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [selectedMatches]);
  const filtered = useMemo(() => {
    let list = selectedMatches;
    if (dateFilter === "__none__") list = selectedMatches.filter((m: any) => !m.kickoff_at);
    else if (dateFilter) list = selectedMatches.filter((m: any) => toLocalDate(m.kickoff_at) === dateFilter);
    return [...list].sort(byKickoff);
  }, [selectedMatches, dateFilter]);

  // Reset the date filter when the user changes round — but not on the
  // initial mount, so the "today" default survives the first render.
  useEffect(() => {
    if (!dateFilterTouched.current) {
      dateFilterTouched.current = true;
      return;
    }
    setDateFilter("");
  }, [selectedRoundId]);

  // All remaining (unfinished) matches across every round, ordered by current
  // kickoff/round/bracket_position, used by the multi-day auto-fill.
  const remainingMatches = useMemo(() => {
    const list = matches.filter((m: any) => m.phase !== "finished" && m.status !== "finished");
    list.sort((a: any, b: any) => {
      const ra = a.round?.display_order ?? 999;
      const rb = b.round?.display_order ?? 999;
      if (ra !== rb) return ra - rb;
      const ap = a.bracket_position ?? "";
      const bp = b.bracket_position ?? "";
      return ap.localeCompare(bp);
    });
    return list;
  }, [matches]);

  async function saveKickoff(id: string, value: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("kickoff_at", value);
    const ok = await run(setMatchKickoff, fd, {
      successMessage: value ? "Termin sačuvan" : "Termin obrisan",
    });
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
    if (!res.ok) {
      push(res.error, "error");
      return;
    }
    push(`Popunjeno ${selectedMatches.length} termina`, "success");
    setBulkOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {matches.length === 0 || rounds.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-zinc-400 mb-3">Još nema mečeva.</p>
          <p className="text-sm text-zinc-500 mb-4">Pokrenite žreb da generišete grupne mečeve.</p>
          <Link href="/admin/draw" className="btn-primary inline-flex">
            Pokreni žreb →
          </Link>
        </div>
      ) : (
        <>
          {/* Auto-fill across multiple days */}
          <AutoFillPanel
            remainingMatches={remainingMatches}
            isOpen={autoFillOpen}
            onToggle={() => setAutoFillOpen((s) => !s)}
            onSaved={() => {
              router.refresh();
              setAutoFillOpen(false);
            }}
          />

          <ShiftSchedulePanel onSaved={() => router.refresh()} />

          {/* Round tabs — "Sva kola" first and selected by default */}
          <div className="card !p-2 overflow-x-auto">
            <div className="flex gap-1 whitespace-nowrap">
              <button
                onClick={() => setSelectedRoundId(ALL)}
                className={`px-3 py-1.5 rounded-md text-sm inline-flex items-center gap-1.5 transition ${
                  selectedRoundId === ALL
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800"
                }`}
              >
                Sva kola
                <span className={`text-xs ${selectedRoundId === ALL ? "text-blue-100" : "text-zinc-400"}`}>
                  ({matches.length})
                </span>
              </button>
              {rounds.map((r) => {
                const count = matchesByRound.get(r.id)?.length ?? 0;
                const finished =
                  (matchesByRound.get(r.id) ?? []).every(
                    (m: any) => m.phase === "finished" || m.status === "finished",
                  ) && count > 0;
                const active = selectedRoundId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoundId(r.id)}
                    className={`px-3 py-1.5 rounded-md text-sm inline-flex items-center gap-1.5 transition ${
                      active
                        ? "bg-blue-600 text-white"
                        : finished
                        ? "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                        : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800"
                    }`}
                  >
                    {finished && <Lock className="w-3 h-3" />}
                    {r.name}
                    <span className={`text-xs ${active ? "text-blue-100" : "text-zinc-400"}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRoundId !== ALL && selectedMatches.length > 0 && (
            <details className="card !py-2">
              <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-200 select-none">
                Napredno: popuni termine samo za ovo kolo
              </summary>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={openBulk}
                  className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Popuni termine za ovo kolo
                </button>
                <span className="text-xs text-zinc-500">
                  {selectedMatches.length} mečeva, sekvencijalno (početak + razmak).
                </span>
              </div>
            </details>
          )}

          {datesInSelected.length > 1 && (
            <div className="card flex flex-wrap items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-400">Filter po danu:</span>
              <select
                className="input !py-1 !w-auto"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="">Svi dani ({selectedMatches.length})</option>
                {datesInSelected.map((d) => {
                  const c = selectedMatches.filter((m: any) => toLocalDate(m.kickoff_at) === d).length;
                  return (
                    <option key={d} value={d}>
                      {d} ({c})
                    </option>
                  );
                })}
                {selectedMatches.some((m: any) => !m.kickoff_at) && (
                  <option value="__none__">
                    Bez termina ({selectedMatches.filter((m: any) => !m.kickoff_at).length})
                  </option>
                )}
              </select>
              {dateFilter && (
                <button
                  onClick={() => setDateFilter("")}
                  className="btn-secondary !py-1 !px-2 text-xs inline-flex items-center gap-1"
                >
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
                  <tr key={m.id} className="border-t border-zinc-800">
                    <td className="text-zinc-400 min-w-[240px] py-2">
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
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="btn-secondary !py-1 !px-2 text-xs"
                          >
                            Otkaži
                          </button>
                          {m.kickoff_at && (
                            <button
                              type="button"
                              onClick={() => saveKickoff(m.id, "")}
                              className="btn-danger !py-1 !px-2 text-xs"
                              title="Obriši termin"
                            >
                              Obriši
                            </button>
                          )}
                        </form>
                      ) : (
                        <button
                          onClick={() => setEditingId(m.id)}
                          className="text-left hover:text-blue-300"
                        >
                          {m.kickoff_at ? (
                            formatKickoff(m.kickoff_at)
                          ) : (
                            <span className="text-zinc-400 italic">+ dodaj termin</span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="min-w-0">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TeamCrest
                            name={m.home?.name ?? "?"}
                            shortName={m.home?.short_name}
                            primaryColor={m.home?.primary_color}
                            secondaryColor={m.home?.secondary_color} logoUrl={m.home?.logo_url}
                            size={18}
                          />
                          <span className="truncate flex-1">{m.home?.name}</span>
                          <b className="tabular-nums shrink-0">{m.home_score}</b>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TeamCrest
                            name={m.away?.name ?? "?"}
                            shortName={m.away?.short_name}
                            primaryColor={m.away?.primary_color}
                            secondaryColor={m.away?.secondary_color} logoUrl={m.away?.logo_url}
                            size={18}
                          />
                          <span className="truncate flex-1">{m.away?.name}</span>
                          <b className="tabular-nums shrink-0">{m.away_score}</b>
                        </div>
                      </div>
                    </td>
                    <td>
                      {m.status === "live" && (
                        <span className="badge-live">
                          <span className="live-dot" />
                          UŽIVO
                        </span>
                      )}
                      {m.status === "finished" && <span className="badge-finished">Završeno</span>}
                      {m.status === "scheduled" && <span className="badge-scheduled">Zakazano</span>}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="inline-flex flex-col sm:flex-row items-end sm:items-center gap-1">
                        <Link
                          href={`/admin/matches/${m.id}/live`}
                          className="btn-secondary !py-1 !px-2 text-xs"
                        >
                          Otvori
                        </Link>
                        {(m.phase === "scheduled" || m.status === "scheduled") && (
                          <form
                            className="inline"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!confirm("Pokrenuti prvo poluvreme? Kolo će biti aktivirano.")) return;
                              const fd = new FormData();
                              fd.set("id", m.id);
                              await run(startFirstHalf, fd, { successMessage: "Uživo" });
                            }}
                          >
                            <button className="btn-primary !py-1 !px-2 text-xs">Pokreni</button>
                          </form>
                        )}
                        {(m.phase === "second_half" || (m.phase == null && m.status === "live")) && (
                          <form
                            className="inline"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!confirm("Završiti meč?")) return;
                              const fd = new FormData();
                              fd.set("id", m.id);
                              await run(finishMatch, fd, { successMessage: "Završeno" });
                            }}
                          >
                            <button className="btn-primary !py-1 !px-2 text-xs">Završi</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-zinc-500">
                      Nema mečeva u izabranom kolu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {bulkOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => !bulkBusy && setBulkOpen(false)}
        >
          <div
            className="bg-zinc-900 rounded-xl p-4 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" /> Popuni termine za ovo kolo
            </h3>
            <p className="text-sm text-zinc-400 mb-3">
              Postavlja termine za <b>{selectedMatches.length} mečeva</b> u izabranom kolu,
              jedan za drugim sa razmakom.
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
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => setBulkOpen(false)}
                disabled={bulkBusy}
                className="btn-secondary"
              >
                Otkaži
              </button>
              <button
                onClick={runBulkFill}
                disabled={bulkBusy || !bulkStart}
                className="btn-primary"
              >
                {bulkBusy ? "Popunjavam…" : "Popuni"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------- Multi-day auto-fill panel -------------------- */

/* -------------------- Shift schedule (no-play day) -------------------- */

function ShiftSchedulePanel({ onSaved }: { onSaved: () => void }) {
  const { push } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = (() => {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  })();
  const [open, setOpen] = useState(false);
  const [offDate, setOffDate] = useState(tomorrow);
  const [createNews, setCreateNews] = useState(true);
  const [busy, setBusy] = useState(false);

  // Recommend the news checkbox whenever the off-day is "tomorrow".
  const isTomorrow = offDate === tomorrow;
  useEffect(() => {
    if (isTomorrow) setCreateNews(true);
  }, [isTomorrow]);

  async function onSubmit() {
    if (!offDate) return;
    if (
      !confirm(
        `Svi mečevi od ${offDate} (uključujući taj dan) biće pomereni za jedan dan kasnije. Nastaviti?`,
      )
    )
      return;
    setBusy(true);
    const res = await shiftScheduleFromDate({ off_date: offDate, create_news: createNews });
    setBusy(false);
    if (!res.ok) {
      push(res.error, "error");
      return;
    }
    push(`Pomereno ${res.data?.shifted ?? 0} termina`, "success");
    setOpen(false);
    onSaved();
  }

  return (
    <div className="card !py-2.5 border-red-500/40 bg-red-500/[0.06]">
      <button onClick={() => setOpen((s) => !s)} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-red-300 shrink-0" />
          <div>
            <div className="font-medium text-sm text-red-200">Neradni dan — pomeri raspored</div>
            <div className="text-[11px] text-zinc-500">
              Odaberi dan kad se ne igra; svi mečevi od tog dana se pomeraju +1 dan.
            </div>
          </div>
        </div>
        <span className="text-xs text-red-300 shrink-0">{open ? "Sakri" : "Otvori"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
            <label className="block">
              <span className="label">Neradni dan</span>
              <input
                type="date"
                className="input"
                min={today}
                value={offDate}
                onChange={(e) => setOffDate(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer text-zinc-300">
              <input
                type="checkbox"
                checked={createNews}
                disabled={!isTomorrow}
                onChange={(e) => setCreateNews(e.target.checked)}
              />
              <span>
                Objavi vest da se izabranog dana ne igra
                {!isTomorrow && (
                  <span className="block text-[11px] text-zinc-500">
                    (dostupno samo kad je neradni dan tačno sutra)
                  </span>
                )}
              </span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} disabled={busy} className="btn-secondary">
              Otkaži
            </button>
            <button onClick={onSubmit} disabled={busy} className="btn-primary inline-flex items-center gap-2">
              <Calendar className="w-4 h-4" /> {busy ? "Pomerim…" : "Pomeri termine"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AutoFillPanel({
  remainingMatches,
  isOpen,
  onToggle,
  onSaved,
}: {
  remainingMatches: any[];
  isOpen: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { push } = useToast();
  const [startDate, setStartDate] = useState<string>(today);
  const [startTime, setStartTime] = useState<string>("09:00");
  const [maxPerDay, setMaxPerDay] = useState<number>(4);
  const [duration, setDuration] = useState<number>(40);
  const [skipDates, setSkipDates] = useState<string[]>([]);
  const [skipInput, setSkipInput] = useState<string>("");
  const [busy, setBusy] = useState(false);

  function addSkip() {
    if (!skipInput) return;
    if (skipDates.includes(skipInput)) {
      setSkipInput("");
      return;
    }
    setSkipDates((arr) => [...arr, skipInput].sort());
    setSkipInput("");
  }

  function removeSkip(d: string) {
    setSkipDates((arr) => arr.filter((x) => x !== d));
  }

  // Live preview of first N kickoffs — mirrors the server's auto-fill rules
  // exactly (group pool + one pool per knockout round, >= 3 matches per day
  // when possible).
  const preview = useMemo(() => {
    if (remainingMatches.length === 0)
      return [] as Array<{ id: string; date: string; time: string; label: string }>;
    const skipSet = new Set(skipDates);
    function shift(d: string, days: number) {
      const [y, m, da] = d.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, da));
      dt.setUTCDate(dt.getUTCDate() + days);
      return dt.toISOString().slice(0, 10);
    }
    function plan(total: number, perDay: number): number[] {
      if (total <= 0) return [];
      if (total < 3) return [total];
      if (total <= perDay) return [total];
      let days = Math.ceil(total / perDay);
      while (days > 1 && Math.floor(total / days) < 3) days--;
      const base = Math.floor(total / days);
      const rem = total % days;
      return Array.from({ length: days }, (_, i) => (i < rem ? base + 1 : base));
    }

    // Bucket into pools (group + one per knockout round).
    type Pool = { matches: any[] };
    const groupPool: Pool = { matches: [] };
    const knockoutPools = new Map<string, Pool>();
    const knockoutOrder: string[] = [];
    for (const m of remainingMatches) {
      const stage = m.round?.stage ?? "group";
      const roundId = m.round?.id ?? m.round_id;
      if (stage === "knockout") {
        if (!knockoutPools.has(roundId)) {
          knockoutPools.set(roundId, { matches: [] });
          knockoutOrder.push(roundId);
        }
        knockoutPools.get(roundId)!.matches.push(m);
      } else {
        groupPool.matches.push(m);
      }
    }
    const pools: Pool[] = [];
    if (groupPool.matches.length > 0) pools.push(groupPool);
    for (const rid of knockoutOrder) pools.push(knockoutPools.get(rid)!);

    const [hh, mm] = startTime.split(":").map(Number);
    let day = startDate;
    while (skipSet.has(day)) day = shift(day, 1);
    let firstPool = true;
    const items: Array<{ id: string; date: string; time: string; label: string }> = [];

    outer: for (const pool of pools) {
      if (!firstPool) {
        day = shift(day, 1);
        while (skipSet.has(day)) day = shift(day, 1);
      }
      firstPool = false;
      const dailyPlan = plan(pool.matches.length, maxPerDay);
      let matchIdx = 0;
      for (let d = 0; d < dailyPlan.length; d++) {
        if (d > 0) {
          day = shift(day, 1);
          while (skipSet.has(day)) day = shift(day, 1);
        }
        const dayCount = dailyPlan[d];
        for (let slot = 0; slot < dayCount; slot++) {
          if (items.length >= 8) break outer;
          const m = pool.matches[matchIdx++];
          const totalMin = (hh ?? 0) * 60 + (mm ?? 0) + slot * duration;
          const h = Math.floor(totalMin / 60) % 24;
          const min = totalMin % 60;
          const time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
          items.push({
            id: m.id,
            date: day,
            time,
            label: `${m.home?.name ?? "?"} vs ${m.away?.name ?? "?"}`,
          });
        }
      }
    }
    return items;
  }, [remainingMatches, startDate, startTime, maxPerDay, duration, skipDates]);

  async function onSubmit() {
    if (remainingMatches.length === 0) {
      push("Nema preostalih mečeva za auto-popunjavanje", "error");
      return;
    }
    const hasExisting = remainingMatches.some((m: any) => m.kickoff_at);
    if (
      hasExisting &&
      !confirm("Postojeći termini će biti prepisani za sve nezavršene mečeve. Nastaviti?")
    )
      return;
    setBusy(true);
    const res = await bulkAutoFillKickoffs({
      ordered_matches: remainingMatches.map((m: any) => ({
        id: m.id,
        round_id: m.round?.id ?? m.round_id,
      })),
      start_date: startDate,
      start_time: startTime,
      match_duration: duration,
      max_per_day: maxPerDay,
      skip_dates: skipDates,
    });
    setBusy(false);
    if (!res.ok) {
      push(res.error, "error");
      return;
    }
    push(`Popunjeno ${remainingMatches.length} termina`, "success");
    onSaved();
  }

  return (
    <div className="card border-blue-500/40 bg-blue-500/[0.05]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-300" />
          <div>
            <div className="font-semibold">Auto-popuni sve preostale termine</div>
            <div className="text-xs text-zinc-400">
              {remainingMatches.length} nezavršenih mečeva · svaka eliminaciona faza dobija svoj dan
            </div>
          </div>
        </div>
        <span className="text-xs text-blue-300">{isOpen ? "Sakri" : "Otvori"}</span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="block">
              <span className="label">Početak: datum</span>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="label">Početak: vreme</span>
              <input
                type="time"
                className="input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="label">Maks. mečeva po danu</span>
              <input
                type="number"
                min={1}
                max={100}
                className="input"
                value={maxPerDay}
                onChange={(e) => setMaxPerDay(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <label className="block">
              <span className="label">Trajanje meča (min)</span>
              <input
                type="number"
                min={5}
                max={300}
                step={5}
                className="input"
                value={duration}
                onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 5))}
              />
            </label>
          </div>

          <div>
            <span className="label">Preskoči dane (npr. praznik, pauza)</span>
            <div className="flex gap-2 items-center mb-2">
              <input
                type="date"
                className="input !py-1.5 !w-auto"
                value={skipInput}
                onChange={(e) => setSkipInput(e.target.value)}
              />
              <button
                type="button"
                onClick={addSkip}
                disabled={!skipInput}
                className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Dodaj
              </button>
            </div>
            {skipDates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {skipDates.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-full pl-2.5 pr-1 py-1 text-xs"
                  >
                    {d}
                    <button
                      onClick={() => removeSkip(d)}
                      className="hover:bg-zinc-700 rounded-full p-0.5"
                      title="Ukloni"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 italic">Bez preskočenih dana.</p>
            )}
          </div>

          {preview.length > 0 && (
            <div className="text-xs bg-zinc-900 border border-zinc-800 rounded-md p-2">
              <div className="font-medium text-zinc-300 mb-1">Pregled prvih {preview.length} mečeva:</div>
              {preview.map((p, i) => (
                <div key={p.id} className="truncate text-zinc-400">
                  <span className="text-zinc-500 tabular-nums">{p.date} {p.time}</span> — {p.label}
                  {i < preview.length - 1 && remainingMatches.length > 8 && i === preview.length - 1 && (
                    <span className="text-zinc-500"> … i još {remainingMatches.length - 8}</span>
                  )}
                </div>
              ))}
              {remainingMatches.length > preview.length && (
                <div className="text-zinc-500 mt-0.5">… i još {remainingMatches.length - preview.length}</div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onToggle}
              disabled={busy}
              className="btn-secondary"
            >
              Otkaži
            </button>
            <button
              onClick={onSubmit}
              disabled={busy || remainingMatches.length === 0}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {busy ? "Popunjavam…" : `Popuni ${remainingMatches.length} termina`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
