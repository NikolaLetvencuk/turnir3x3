"use client";

import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
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
  home_placeholder?: string | null;
  away_placeholder?: string | null;
  knockout_winner_id?: string | null;
  home_team: TeamLite | null;
  away_team: TeamLite | null;
};

type Format = "story" | "post";
type PosterKind = "results" | "standings" | "scorers" | "bracket";
type ResultsMode = "round" | "day";

const RESULTS_MAX = { story: 9, post: 6 } as const;

// Bin-packing budgets per image — sum of (team_count + 1) for every group on
// the slika must fit:
//   Story (1080×1920) — 18 units
//   Objava (1080×1350) — 12 units
// The +1 per group accounts for the group's title row.
const STANDINGS_BUDGET = { story: 18, post: 12 } as const;
const GROUP_HEADER_COST = 1;

function chunkStandingsByBudget(groups: GroupStandings[], budget: number): GroupStandings[][] {
  const chunks: GroupStandings[][] = [];
  let current: GroupStandings[] = [];
  let currentSize = 0;
  for (const g of groups) {
    const cost = g.rows.length + GROUP_HEADER_COST;
    if (current.length > 0 && currentSize + cost > budget) {
      chunks.push(current);
      current = [g];
      currentSize = cost;
    } else {
      current.push(g);
      currentSize += cost;
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

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
  const [includeThirdPlaceBracket, setIncludeThirdPlaceBracket] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Bracket data — knockout matches with full slot info for the poster.
  const knockoutRounds = useMemo(
    () => rounds.filter((r) => r.stage === "knockout").sort((a, b) => a.display_order - b.display_order),
    [rounds],
  );
  const knockoutRoundIndex = useMemo(() => {
    const map = new Map<string, number>();
    knockoutRounds.forEach((r, i) => map.set(r.id, i));
    return map;
  }, [knockoutRounds]);
  const bracketMatches = useMemo(
    () => matches.filter((m) => m.bracket_position && knockoutRoundIndex.has(m.round_id)),
    [matches, knockoutRoundIndex],
  );
  const hasBracket = bracketMatches.length > 0;

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
    if (resultsMode === "round") return round?.name ?? "PETROVSKI KULA";
    return selectedDay ? formatDateLabel(selectedDay).toUpperCase() : "PETROVSKI KULA";
  }
  function effectiveSubtitle(): string {
    if (resultsMode === "round") {
      return round?.stage === "knockout" ? "Eliminacije" : "Grupna faza";
    }
    return "Mečevi dana";
  }

  async function fetchAndDownloadPng(payload: any, filename: string): Promise<boolean> {
    const response = await fetch("/api/export/poster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("image/")) {
      const txt = await response.text();
      alert(`Greška pri generisanju (${response.status}, ${contentType}):\n${txt.slice(0, 400)}`);
      return false;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\s+/g, "-").toLowerCase();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  }

  async function downloadPoster(kind: PosterKind, format: Format) {
    const tag = `${kind}-${format}`;
    setDownloading(tag);
    try {
      if (kind === "results") {
        // Auto-split into multiple posters if selection exceeds per-format cap.
        const max = RESULTS_MAX[format];
        const chunks: ExportMatch[][] = [];
        for (let i = 0; i < exportMatches.length; i += max) {
          chunks.push(exportMatches.slice(i, i + max));
        }
        const total = chunks.length;
        const baseSlug =
          resultsMode === "round"
            ? `results-${format}-${round?.name ?? "export"}`
            : `results-${format}-${selectedDay}`;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const payload = {
            kind,
            format,
            title: effectiveTitle(),
            subtitle: effectiveSubtitle(),
            matches: chunk.map((m) => ({
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
          };
          const partSuffix = total > 1 ? `-deo-${i + 1}-od-${total}` : "";
          const ok = await fetchAndDownloadPng(payload, `turnir-kula-${baseSlug}${partSuffix}.png`);
          if (!ok) break;
          if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 800));
        }
      } else if (kind === "standings") {
        // Bin-pack groups by (teams + 1) units per group, with a budget of
        // 12 for Objava and 18 for Stori. Each next group is added until
        // budget would overflow, then a new image starts.
        const chunks = chunkStandingsByBudget(exportStandings, STANDINGS_BUDGET[format]);

        const total = chunks.length;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const payload = {
            kind,
            format,
            standings: chunk.map((g) => ({
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
          };
          const groupNames = chunk.map((g) => g.group_name).join("-");
          const partSuffix = total > 1 ? `-deo-${i + 1}-od-${total}` : "";
          const slug = `standings-${format}-${groupNames}${partSuffix}`;
          const ok = await fetchAndDownloadPng(payload, `turnir-kula-${slug}.png`);
          if (!ok) break;
          if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 800));
        }
      } else if (kind === "bracket") {
        const payload = {
          kind,
          format,
          bracket: {
            rounds: knockoutRounds.map((r) => ({
              name: r.name,
              round_index: knockoutRoundIndex.get(r.id) ?? 0,
            })),
            matches: bracketMatches.map((m) => ({
              id: m.id,
              bracket_position: m.bracket_position!,
              round_name: knockoutRounds.find((r) => r.id === m.round_id)?.name ?? "",
              round_index: knockoutRoundIndex.get(m.round_id) ?? 0,
              home_team: m.home_team,
              away_team: m.away_team,
              home_placeholder: m.home_placeholder ?? null,
              away_placeholder: m.away_placeholder ?? null,
              home_score: m.status === "finished" || m.status === "live" ? m.home_score : null,
              away_score: m.status === "finished" || m.status === "live" ? m.away_score : null,
              status: m.status,
              winner_team_id: m.knockout_winner_id ?? null,
            })),
            include_third_place: includeThirdPlaceBracket,
          },
        };
        await fetchAndDownloadPng(payload, `turnir-kula-bracket-${format}.png`);
      } else {
        const payload = {
          kind,
          format,
          scorers: scorers.map((s) => ({
            player_id: s.player_id,
            player_name: s.player_name,
            team_name: s.team_name,
            goals: s.goals,
          })),
        };
        await fetchAndDownloadPng(payload, `turnir-kula-scorers-${format}.png`);
      }
    } finally {
      setDownloading(null);
    }
  }

  const standingsChunkStory = useMemo(
    () => chunkStandingsByBudget(exportStandings, STANDINGS_BUDGET.story).length,
    [exportStandings],
  );
  const standingsChunkPost = useMemo(
    () => chunkStandingsByBudget(exportStandings, STANDINGS_BUDGET.post).length,
    [exportStandings],
  );
  const standingsWillSplit = standingsChunkStory > 1 || standingsChunkPost > 1;
  const standingsTotalUnits = useMemo(
    () => exportStandings.reduce((acc, g) => acc + g.rows.length + GROUP_HEADER_COST, 0),
    [exportStandings],
  );

  const resultsChunkStory = Math.ceil(exportMatches.length / RESULTS_MAX.story) || 0;
  const resultsChunkPost = Math.ceil(exportMatches.length / RESULTS_MAX.post) || 0;
  const resultsWillSplit = resultsChunkStory > 1 || resultsChunkPost > 1;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Share2}
        title="Export"
        hint="Pravi gotove slike za Story (1080×1920) i Objavu (1080×1350). Klikni Generiši pa Preuzmi."
        tone="blue"
      />

      {/* Self-contained download cards: each one has its own filters folded
          inside a collapsible "Podesi" panel so the screen stays compact
          unless the user explicitly opens settings. */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* === Rezultati === */}
        <ExportCard
          title="Rezultati"
          subtitle={`${exportMatches.length} mečeva izabrano`}
          disabled={exportMatches.length === 0}
          downloading={downloading}
          kind="results"
          onDownload={downloadPoster}
        >
          <details>
            <summary className="cursor-pointer text-xs text-blue-300 hover:text-blue-200 select-none">
              Podesi filtere
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Filtriraj po</div>
                <div className="inline-flex rounded-md border border-zinc-700 overflow-hidden">
                  <button
                    onClick={() => changeMode("round")}
                    className={`px-3 py-1.5 text-sm ${resultsMode === "round" ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
                  >
                    Kolu
                  </button>
                  <button
                    onClick={() => changeMode("day")}
                    disabled={allDates.length === 0}
                    className={`px-3 py-1.5 text-sm border-l border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed ${resultsMode === "day" ? "bg-blue-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
                  >
                    Danu
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                {resultsMode === "round" ? (
                  <label className="block">
                    <span className="text-xs text-zinc-400">Kolo</span>
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
                    <span className="text-xs text-zinc-400">Dan</span>
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
                  <span className="text-xs text-zinc-400">Naslov (opciono)</span>
                  <input
                    className="input"
                    placeholder={effectiveTitle()}
                    value={resultsTitle}
                    onChange={(e) => setResultsTitle(e.target.value)}
                  />
                </label>
              </div>

              {candidateMatches.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400">
                      Mečevi ({selectedMatchIds.size} / {candidateMatches.length})
                    </span>
                    <div className="text-xs flex gap-2">
                      <button
                        onClick={() => setSelectedMatchIds(new Set(candidateMatches.map((m) => m.id)))}
                        className="text-blue-300 hover:underline"
                      >
                        Sve
                      </button>
                      <span className="text-zinc-300">·</span>
                      <button onClick={() => setSelectedMatchIds(new Set())} className="text-blue-300 hover:underline">
                        Nijedan
                      </button>
                    </div>
                  </div>
                  <ul className="space-y-1 max-h-48 overflow-y-auto border border-zinc-800 rounded-md p-2 bg-zinc-900">
                    {(resultsMode === "round" ? sortedRoundDateKeys : sortedDayRoundIds).map((key) => {
                      const list =
                        resultsMode === "round"
                          ? roundMatchesByDate.get(key) ?? []
                          : dayMatchesByRound.get(key) ?? [];
                      const label =
                        resultsMode === "round"
                          ? key === "__no_date__"
                            ? "Bez termina"
                            : formatDateLabel(key)
                          : roundsById.get(key)?.name ?? "?";
                      return (
                        <li key={key} className="space-y-0.5">
                          {(resultsMode === "round" ? sortedRoundDateKeys.length : sortedDayRoundIds.length) > 1 && (
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
                    })}
                  </ul>
                </div>
              ) : (
                <div className="text-xs text-zinc-500 italic">Nema mečeva za izabrani filter.</div>
              )}

              {resultsWillSplit && (
                <InfoBox>
                  Selekcija premašuje 1 sliku — biće podeljeno na{" "}
                  <b>{resultsChunkStory} fajla za Stori</b> i <b>{resultsChunkPost} za Objavu</b>.
                </InfoBox>
              )}
            </div>
          </details>
        </ExportCard>

        {/* === Tabele === */}
        <ExportCard
          title="Tabele"
          subtitle={`${exportStandings.length} / ${standings.length} grupa`}
          disabled={exportStandings.length === 0}
          downloading={downloading}
          kind="standings"
          onDownload={downloadPoster}
        >
          {standings.length > 1 && (
            <details>
              <summary className="cursor-pointer text-xs text-blue-300 hover:text-blue-200 select-none">
                Izaberi grupe ({selectedGroupIds.size} / {standings.length})
              </summary>
              <div className="mt-3 space-y-2">
                <div className="text-xs flex gap-2 justify-end">
                  <button onClick={() => setSelectedGroupIds(new Set(standings.map((g) => g.group_id)))} className="text-blue-300 hover:underline">Sve</button>
                  <span className="text-zinc-300">·</span>
                  <button onClick={() => setSelectedGroupIds(new Set())} className="text-blue-300 hover:underline">Nijedna</button>
                </div>
                <div className="grid grid-cols-2 gap-1 border border-zinc-800 rounded-md p-2 bg-zinc-900">
                  {standings.map((g) => (
                    <label key={g.group_id} className="flex items-center gap-2 text-sm hover:bg-zinc-800 rounded px-2 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.has(g.group_id)}
                        onChange={() => toggleGroup(g.group_id)}
                      />
                      <span className="truncate">{g.group_name}</span>
                    </label>
                  ))}
                </div>
                {standingsWillSplit && (
                  <InfoBox>
                    Selekcija premašuje 1 sliku — biće podeljeno na{" "}
                    <b>{standingsChunkStory} fajla za Stori</b>, <b>{standingsChunkPost} za Objavu</b>.
                  </InfoBox>
                )}
              </div>
            </details>
          )}
        </ExportCard>

        {/* === Eliminacije === */}
        <ExportCard
          title="Eliminacije"
          subtitle={hasBracket ? `${bracketMatches.length} meča u kosturu` : "nema kostura"}
          disabled={!hasBracket}
          downloading={downloading}
          kind="bracket"
          onDownload={downloadPoster}
        >
          {hasBracket && (
            <label className="flex items-center gap-2 text-sm cursor-pointer text-zinc-300">
              <input
                type="checkbox"
                checked={includeThirdPlaceBracket}
                onChange={(e) => setIncludeThirdPlaceBracket(e.target.checked)}
              />
              Uključi meč za 3. mesto
            </label>
          )}
        </ExportCard>

        {/* === Strelci === */}
        <ExportCard
          title="Strelci"
          subtitle={`Top ${Math.min(10, scorers.length)}`}
          disabled={scorers.length === 0}
          downloading={downloading}
          kind="scorers"
          onDownload={downloadPoster}
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
    <label className="flex items-center gap-2 text-sm hover:bg-zinc-800 rounded px-2 py-1.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="flex-1 truncate">
        {match.home_team?.name ?? "?"} vs {match.away_team?.name ?? "?"}
        {roundBadge && (
          <span className="ml-2 text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-700 rounded px-1.5 py-0.5">
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-blue-300 bg-blue-50 text-blue-900 text-xs rounded-md px-3 py-2">
      ℹ {children}
    </div>
  );
}

function ExportCard({
  title,
  subtitle,
  disabled,
  downloading,
  kind,
  onDownload,
  children,
}: {
  title: string;
  subtitle: string;
  disabled: boolean;
  downloading: string | null;
  kind: PosterKind;
  onDownload: (kind: PosterKind, format: Format) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-zinc-500">{subtitle}</span>
      </div>
      {children}
      <div className="mt-auto grid grid-cols-2 gap-2">
        <button
          onClick={() => onDownload(kind, "story")}
          disabled={disabled || !!downloading}
          className="btn-primary !py-2 text-sm"
        >
          {downloading === `${kind}-story` ? "..." : "Stori 1080×1920"}
        </button>
        <button
          onClick={() => onDownload(kind, "post")}
          disabled={disabled || !!downloading}
          className="btn-secondary !py-2 text-sm"
        >
          {downloading === `${kind}-post` ? "..." : "Objava 1080×1350"}
        </button>
      </div>
    </div>
  );
}
