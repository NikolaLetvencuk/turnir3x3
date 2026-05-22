"use client";

import { useMemo, useState } from "react";
import type { GroupStandings, TopScorerRow } from "@/lib/standings";

export type ExportRound = {
  id: string;
  name: string;
  stage: string;
  status: string;
  display_order: number;
};

type TeamLite = {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export type ExportMatch = {
  id: string;
  round_id: string;
  status: string;
  phase: string | null;
  home_score: number;
  away_score: number;
  home_pen: number | null;
  away_pen: number | null;
  kickoff_at: string | null;
  finished_at: string | null;
  bracket_position: string | null;
  home_team: TeamLite | null;
  away_team: TeamLite | null;
};

type Format = "story" | "post";
type PosterKind = "results" | "standings" | "scorers";
type ResultsMode = "round" | "day";

const RESULTS_MAX = { story: 8, post: 5 } as const;
const STANDINGS_MAX = { story: 3, post: 2 } as const;

export function ExportClient({
  rounds,
  matches,
  standings,
  scorers,
}: {
  rounds: ExportRound[];
  matches: ExportMatch[];
  standings: GroupStandings[];
  scorers: TopScorerRow[];
}) {
  const roundsById = useMemo(() => new Map(rounds.map((r) => [r.id, r])), [rounds]);

  // Distinct dates across ALL matches (not just one round)
  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      const key = belgradeDateKey(m.kickoff_at);
      if (key) set.add(key);
    }
    return Array.from(set).sort();
  }, [matches]);

  const initialRoundId =
    rounds.find((r) => r.status === "finished")?.id ?? rounds[0]?.id ?? "";
  const initialDay = allDates[0] ?? "";

  const [resultsMode, setResultsMode] = useState<ResultsMode>("round");
  const [selectedRoundId, setSelectedRoundId] = useState<string>(initialRoundId);
  const [selectedDay, setSelectedDay] = useState<string>(initialDay);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(
    () => new Set(matches.filter((m) => m.round_id === initialRoundId).map((m) => m.id)),
  );
  const [resultsTitle, setResultsTitle] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    () => new Set(standings.map((g) => g.group_id)),
  );
  const [downloading, setDownloading] = useState<string | null>(null);

  const round = rounds.find((r) => r.id === selectedRoundId) ?? null;

  // Pool of matches the user is currently filtering — depends on mode.
  const candidateMatches = useMemo(() => {
    if (resultsMode === "round") {
      return matches.filter((m) => m.round_id === selectedRoundId);
    }
    return matches.filter((m) => belgradeDateKey(m.kickoff_at) === selectedDay);
  }, [matches, resultsMode, selectedRoundId, selectedDay]);

  // Sorted: in day mode by kickoff time; in round mode by kickoff then bracket position
  const sortedCandidates = useMemo(() => {
    return [...candidateMatches].sort((a, b) => {
      const ak = a.kickoff_at ?? "";
      const bk = b.kickoff_at ?? "";
      if (ak && bk) return ak.localeCompare(bk);
      if (ak) return -1;
      if (bk) return 1;
      return 0;
    });
  }, [candidateMatches]);

  const exportMatches = sortedCandidates.filter((m) => selectedMatchIds.has(m.id));
  const exportStandings = standings.filter((g) => selectedGroupIds.has(g.group_id));

  // Round-mode date pills
  const roundMatchesByDate = useMemo(() => {
    const map = new Map<string, ExportMatch[]>();
    if (resultsMode !== "round") return map;
    for (const m of candidateMatches) {
      const key = belgradeDateKey(m.kickoff_at) ?? "__no_date__";
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return map;
  }, [resultsMode, candidateMatches]);

  const sortedRoundDateKeys = useMemo(
    () =>
      Array.from(roundMatchesByDate.keys()).sort((a, b) =>
        a === "__no_date__" ? 1 : b === "__no_date__" ? -1 : a.localeCompare(b),
      ),
    [roundMatchesByDate],
  );

  // Day-mode: group candidates by round (so user sees from which round each match comes)
  const dayMatchesByRound = useMemo(() => {
    const map = new Map<string, ExportMatch[]>();
    if (resultsMode !== "day") return map;
    for (const m of candidateMatches) {
      const arr = map.get(m.round_id) ?? [];
      arr.push(m);
      map.set(m.round_id, arr);
    }
    return map;
  }, [resultsMode, candidateMatches]);

  const sortedDayRoundIds = useMemo(() => {
    return Array.from(dayMatchesByRound.keys()).sort((a, b) => {
      const ra = roundsById.get(a)?.display_order ?? 999;
      const rb = roundsById.get(b)?.display_order ?? 999;
      return ra - rb;
    });
  }, [dayMatchesByRound, roundsById]);

  // Mode change → reset selection to all candidates
  function changeMode(mode: ResultsMode) {
    setResultsMode(mode);
    if (mode === "round") {
      setSelectedMatchIds(new Set(matches.filter((m) => m.round_id === selectedRoundId).map((m) => m.id)));
    } else {
      setSelectedMatchIds(
        new Set(matches.filter((m) => belgradeDateKey(m.kickoff_at) === selectedDay).map((m) => m.id)),
      );
    }
  }
  function changeRound(id: string) {
    setSelectedRoundId(id);
    setSelectedMatchIds(new Set(matches.filter((m) => m.round_id === id).map((m) => m.id)));
  }
  function changeDay(day: string) {
    setSelectedDay(day);
    setSelectedMatchIds(new Set(matches.filter((m) => belgradeDateKey(m.kickoff_at) === day).map((m) => m.id)));
  }
  function toggleMatch(id: string) {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectOnlyDateInRound(key: string) {
    const ids = (roundMatchesByDate.get(key) ?? []).map((m) => m.id);
    setSelectedMatchIds(new Set(ids));
  }
  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Title resolution: respects manual override → mode default
  function effectiveTitle(): string {
    if (resultsTitle) return resultsTitle;
    if (resultsMode === "round") return round?.name ?? "Turnir Kula";
    return selectedDay ? formatDateLabel(selectedDay).toUpperCase() : "Turnir Kula";
  }
  function effectiveSubtitle(): string {
    if (resultsMode === "round") {
      return round?.stage === "knockout" ? "Eliminacije" : "Grupna faza";
    }
    return "Mečevi dana";
  }

  async function downloadPoster(kind: PosterKind, format: Format) {
    const tag = `${kind}-${format}`;
    setDownloading(tag);
    try {
      const payload =
        kind === "results"
          ? {
              kind,
              format,
              title: effectiveTitle(),
              subtitle: effectiveSubtitle(),
              matches: exportMatches.map((m) => ({
                id: m.id,
                status: m.status,
                home_score: m.home_score,
                away_score: m.away_score,
                home_pen: m.home_pen,
                away_pen: m.away_pen,
                kickoff_at: m.kickoff_at,
                home_team: m.home_team,
                away_team: m.away_team,
              })),
            }
          : kind === "standings"
          ? {
              kind,
              format,
              standings: exportStandings.map((g) => ({
                group_id: g.group_id,
                group_name: g.group_name,
                rows: g.rows.map((r) => ({
                  team_id: r.team_id,
                  team_name: r.team_name,
                  short_name: r.short_name,
                  primary_color: r.primary_color,
                  secondary_color: r.secondary_color,
                  played: r.played,
                  goal_diff: r.goal_diff,
                  points: r.points,
                })),
              })),
            }
          : {
              kind,
              format,
              scorers: scorers.map((s) => ({
                player_id: s.player_id,
                player_name: s.player_name,
                team_name: s.team_name,
                goals: s.goals,
              })),
            };

      const response = await fetch("/api/export/poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.startsWith("image/")) {
        const txt = await response.text();
        alert(`Greška pri generisanju (${response.status}, ${contentType}):\n${txt.slice(0, 400)}`);
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const baseSlug =
        kind === "results"
          ? resultsMode === "round"
            ? `results-${format}-${round?.name ?? "export"}`
            : `results-${format}-${selectedDay}`
          : kind === "standings"
          ? `standings-${format}-${exportStandings.length === standings.length ? "sve-grupe" : exportStandings.map((g) => g.group_name).join("-")}`
          : `scorers-${format}`;
      a.href = url;
      a.download = `turnir-kula-${baseSlug}.png`.replace(/\s+/g, "-").toLowerCase();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  const resultsExceedStory = exportMatches.length > RESULTS_MAX.story;
  const resultsExceedPost = exportMatches.length > RESULTS_MAX.post;
  const standingsExceedStory = exportStandings.length > STANDINGS_MAX.story;
  const standingsExceedPost = exportStandings.length > STANDINGS_MAX.post;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Export</h1>
        <p className="text-sm text-zinc-500">
          Server generiše PNG preko <code>next/og</code> (Satori). Story 1080×1920, Objava 1080×1350.
        </p>
      </div>

      {/* Filters for Rezultati */}
      <div className="card space-y-3">
        <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Filteri za &quot;Rezultati&quot;</div>

        {/* Mode toggle */}
        <div>
          <div className="text-xs text-zinc-600 mb-1">Filtriraj po</div>
          <div className="inline-flex rounded-md border border-zinc-300 overflow-hidden">
            <button
              onClick={() => changeMode("round")}
              className={`px-3 py-1.5 text-sm ${resultsMode === "round" ? "bg-blue-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
            >
              Kolu
            </button>
            <button
              onClick={() => changeMode("day")}
              disabled={allDates.length === 0}
              className={`px-3 py-1.5 text-sm border-l border-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed ${resultsMode === "day" ? "bg-blue-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"}`}
            >
              Danu
            </button>
          </div>
          {allDates.length === 0 && (
            <div className="text-[11px] text-zinc-500 italic mt-1">
              Filter po danu je nedostupan dok nijedan meč nema postavljen termin početka.
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {resultsMode === "round" ? (
            <label className="block">
              <span className="text-xs text-zinc-600">Kolo</span>
              <select className="input" value={selectedRoundId} onChange={(e) => changeRound(e.target.value)}>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.status === "finished" ? "✓" : r.status === "active" ? "(uživo)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="text-xs text-zinc-600">Dan</span>
              <select className="input" value={selectedDay} onChange={(e) => changeDay(e.target.value)}>
                {allDates.map((d) => {
                  const count = matches.filter((m) => belgradeDateKey(m.kickoff_at) === d).length;
                  return (
                    <option key={d} value={d}>
                      {formatDateLabel(d)} ({count} mečeva)
                    </option>
                  );
                })}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-xs text-zinc-600">Naslov (opciono)</span>
            <input
              className="input"
              placeholder={effectiveTitle()}
              value={resultsTitle}
              onChange={(e) => setResultsTitle(e.target.value)}
            />
          </label>
        </div>

        {/* Round mode: date pills inside the round */}
        {resultsMode === "round" && candidateMatches.length > 0 && (
          <div>
            <div className="text-xs text-zinc-600 mb-1">Brzo filtriranje po danu (unutar kola)</div>
            {sortedRoundDateKeys.length === 1 && sortedRoundDateKeys[0] === "__no_date__" ? (
              <div className="text-xs text-zinc-500 italic">
                Mečevi u ovom kolu nemaju postavljene termine. Idi na <code>/admin/matches</code>
                i unesi vreme početka da bi filter po danu radio.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedMatchIds(new Set(candidateMatches.map((m) => m.id)))}
                  className="text-xs px-2.5 py-1 rounded-full border border-zinc-300 hover:bg-zinc-100"
                >
                  Sve ({candidateMatches.length})
                </button>
                {sortedRoundDateKeys.map((k) => {
                  const list = roundMatchesByDate.get(k) ?? [];
                  const label = k === "__no_date__" ? "Bez termina" : formatDateLabel(k);
                  return (
                    <button
                      key={k}
                      onClick={() => selectOnlyDateInRound(k)}
                      className="text-xs px-2.5 py-1 rounded-full border border-zinc-300 hover:bg-zinc-100"
                    >
                      {label} ({list.length})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Match list */}
        {candidateMatches.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600">
                Mečevi ({selectedMatchIds.size} / {candidateMatches.length})
              </span>
              <div className="text-xs flex gap-2">
                <button
                  onClick={() => setSelectedMatchIds(new Set(candidateMatches.map((m) => m.id)))}
                  className="text-blue-700 hover:underline"
                >
                  Sve
                </button>
                <span className="text-zinc-300">·</span>
                <button onClick={() => setSelectedMatchIds(new Set())} className="text-blue-700 hover:underline">
                  Nijedan
                </button>
              </div>
            </div>
            <ul className="space-y-1 max-h-64 overflow-y-auto border border-zinc-200 rounded-md p-2 bg-zinc-50">
              {resultsMode === "round"
                ? sortedRoundDateKeys.map((dateKey) => {
                    const list = roundMatchesByDate.get(dateKey) ?? [];
                    const label = dateKey === "__no_date__" ? "Bez termina" : formatDateLabel(dateKey);
                    return (
                      <li key={dateKey} className="space-y-0.5">
                        {sortedRoundDateKeys.length > 1 && (
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold px-2 pt-1">
                            {label}
                          </div>
                        )}
                        {list.map((m) => (
                          <MatchCheckRow
                            key={m.id}
                            match={m}
                            checked={selectedMatchIds.has(m.id)}
                            onChange={() => toggleMatch(m.id)}
                          />
                        ))}
                      </li>
                    );
                  })
                : sortedDayRoundIds.map((roundId) => {
                    const list = dayMatchesByRound.get(roundId) ?? [];
                    const roundName = roundsById.get(roundId)?.name ?? "?";
                    return (
                      <li key={roundId} className="space-y-0.5">
                        {sortedDayRoundIds.length > 1 && (
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold px-2 pt-1">
                            {roundName}
                          </div>
                        )}
                        {list.map((m) => (
                          <MatchCheckRow
                            key={m.id}
                            match={m}
                            checked={selectedMatchIds.has(m.id)}
                            onChange={() => toggleMatch(m.id)}
                            roundBadge={sortedDayRoundIds.length === 1 ? roundName : undefined}
                          />
                        ))}
                      </li>
                    );
                  })}
            </ul>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 italic">Nema mečeva za izabrani filter.</div>
        )}

        {resultsExceedStory && (
          <WarningBox>
            Izabrano je <b>{exportMatches.length} mečeva</b> — možda neće stati u jednu sliku.
            Preporučujemo do <b>{RESULTS_MAX.story} mečeva</b> za Stori, ili podeli po danu i napravi
            više postera (gore su prečice za brzo filtriranje po datumu).
          </WarningBox>
        )}
      </div>

      {/* Filters for Tabele */}
      {standings.length > 1 && (
        <div className="card space-y-3">
          <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Filteri za &quot;Tabele&quot;</div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600">Grupe ({selectedGroupIds.size} / {standings.length})</span>
              <div className="text-xs flex gap-2">
                <button onClick={() => setSelectedGroupIds(new Set(standings.map((g) => g.group_id)))} className="text-blue-700 hover:underline">Sve</button>
                <span className="text-zinc-300">·</span>
                <button onClick={() => setSelectedGroupIds(new Set())} className="text-blue-700 hover:underline">Nijedna</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 border border-zinc-200 rounded-md p-2 bg-zinc-50">
              {standings.map((g) => (
                <label key={g.group_id} className="flex items-center gap-2 text-sm hover:bg-white rounded px-2 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.has(g.group_id)}
                    onChange={() => toggleGroup(g.group_id)}
                  />
                  <span className="truncate">{g.group_name}</span>
                </label>
              ))}
            </div>
          </div>
          {standingsExceedStory && (
            <WarningBox>
              Izabrano je <b>{exportStandings.length} grupa</b> — možda neće stati u jednu sliku.
              Preporučujemo do <b>{STANDINGS_MAX.story} grupe</b> za Stori, ili napravi više postera
              (svaka grupa zasebno).
            </WarningBox>
          )}
        </div>
      )}

      {/* Three poster cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <DownloadCard
          title="Rezultati"
          subtitle={`${exportMatches.length} mečeva`}
          disabled={exportMatches.length === 0}
          downloading={downloading}
          kind="results"
          onDownload={downloadPoster}
          exceedPost={resultsExceedPost}
          exceedStory={resultsExceedStory}
        />
        <DownloadCard
          title="Tabele"
          subtitle={`${exportStandings.length} / ${standings.length} grupa`}
          disabled={exportStandings.length === 0}
          downloading={downloading}
          kind="standings"
          onDownload={downloadPoster}
          exceedPost={standingsExceedPost}
          exceedStory={standingsExceedStory}
        />
        <DownloadCard
          title="Strelci"
          subtitle={`Top ${Math.min(10, scorers.length)}`}
          disabled={scorers.length === 0}
          downloading={downloading}
          kind="scorers"
          onDownload={downloadPoster}
          exceedPost={false}
          exceedStory={false}
        />
      </div>
    </div>
  );
}

function MatchCheckRow({
  match,
  checked,
  onChange,
  roundBadge,
}: {
  match: ExportMatch;
  checked: boolean;
  onChange: () => void;
  roundBadge?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm hover:bg-white rounded px-2 py-1.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="flex-1 truncate">
        {match.home_team?.name ?? "?"} vs {match.away_team?.name ?? "?"}
        {roundBadge && (
          <span className="ml-2 text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-200 rounded px-1.5 py-0.5">
            {roundBadge}
          </span>
        )}
      </span>
      <span className="text-xs text-zinc-500 tabular-nums">
        {match.status === "finished" || match.status === "live" ? formatScore(match) : "—"}
      </span>
    </label>
  );
}

function formatScore(m: ExportMatch): string {
  const base = `${m.home_score} : ${m.away_score}`;
  if (m.home_pen != null && m.away_pen != null) return `${base} (p ${m.home_pen}-${m.away_pen})`;
  return base;
}

function belgradeDateKey(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Belgrade",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(d); // "2026-05-25"
  } catch {
    return null;
  }
}

const SR_MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
function formatDateLabel(isoKey: string): string {
  const parts = isoKey.split("-");
  if (parts.length !== 3) return isoKey;
  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (Number.isNaN(day) || monthIdx < 0 || monthIdx > 11) return isoKey;
  return `${day}. ${SR_MONTHS_SHORT[monthIdx]}`;
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-amber-300 bg-amber-50 text-amber-900 text-xs rounded-md px-3 py-2">
      ⚠ {children}
    </div>
  );
}

function DownloadCard({
  title,
  subtitle,
  disabled,
  downloading,
  kind,
  onDownload,
  exceedStory,
  exceedPost,
}: {
  title: string;
  subtitle: string;
  disabled: boolean;
  downloading: string | null;
  kind: PosterKind;
  onDownload: (kind: PosterKind, format: Format) => void;
  exceedStory: boolean;
  exceedPost: boolean;
}) {
  return (
    <div className="card flex flex-col">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-zinc-500">{subtitle}</span>
      </div>
      <p className="text-xs text-zinc-500 mb-3">
        Generiše se na serveru. Klikni dugme za preuzimanje.
      </p>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <button
          onClick={() => onDownload(kind, "story")}
          disabled={disabled || !!downloading}
          className="btn-primary !py-2 text-sm"
          title={exceedStory ? "Selekcija je velika — možda neće stati u sliku" : undefined}
        >
          {downloading === `${kind}-story` ? "..." : exceedStory ? "Stori ⚠" : "Stori 1080×1920"}
        </button>
        <button
          onClick={() => onDownload(kind, "post")}
          disabled={disabled || !!downloading}
          className="btn-secondary !py-2 text-sm"
          title={exceedPost ? "Selekcija je velika — možda neće stati u sliku" : undefined}
        >
          {downloading === `${kind}-post` ? "..." : exceedPost ? "Objava ⚠" : "Objava 1080×1350"}
        </button>
      </div>
    </div>
  );
}
