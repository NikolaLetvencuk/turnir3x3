"use client";

import { useEffect, useMemo, useState } from "react";
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

  // Detect R16 round (first round with > 4 matches — i.e. 16-team start).
  // We use round_index to be order-independent of round naming.
  const firstRoundId = knockoutRounds[0]?.id ?? null;
  const firstRoundMatches = useMemo(
    () => (firstRoundId ? bracketMatches.filter((m) => m.round_id === firstRoundId && m.bracket_position !== "TP") : []),
    [bracketMatches, firstRoundId],
  );
  const has16Teams = firstRoundMatches.length === 8; // 8 R16 matches = 16 teams
  const allR16Finished = has16Teams && firstRoundMatches.every((m) => m.status === "finished");

  // "Include R16" toggle:
  //  - When R16 hasn't started or is in progress, must include it (no choice).
  //  - When all R16 finished, default to false (abbreviated bracket from QF).
  const [includeR16, setIncludeR16] = useState<boolean>(true);
  useEffect(() => {
    setIncludeR16(!allR16Finished);
  }, [allR16Finished]);

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
    if (resultsMode === "round") return round?.name ?? "TURNIR 3X3";
    return selectedDay ? formatDateLabel(selectedDay).toUpperCase() : "TURNIR 3X3";
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

  async function postResultsList(
    list: ExportMatch[],
    format: Format,
    title: string,
    subtitle: string,
    baseSlug: string,
  ) {
    const max = RESULTS_MAX[format];
    const chunks: ExportMatch[][] = [];
    for (let i = 0; i < list.length; i += max) chunks.push(list.slice(i, i + max));
    const total = chunks.length;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const payload = {
        kind: "results" as const,
        format,
        title,
        subtitle,
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
      const ok = await fetchAndDownloadPng(payload, `turnir-kula-${baseSlug}-${format}${partSuffix}.png`);
      if (!ok) break;
      if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 800));
    }
  }

  async function postStandingsList(list: GroupStandings[], format: Format, baseSlug: string) {
    const chunks = chunkStandingsByBudget(list, STANDINGS_BUDGET[format]);
    const total = chunks.length;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const payload = {
        kind: "standings" as const,
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
      const partSuffix = total > 1 ? `-deo-${i + 1}-od-${total}` : "";
      const ok = await fetchAndDownloadPng(payload, `turnir-kula-${baseSlug}-${format}${partSuffix}.png`);
      if (!ok) break;
      if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 800));
    }
  }

  // Quick downloads (don't touch the custom filter state) ---------------------
  async function quickDownload(tag: string, fn: () => Promise<void>) {
    setDownloading(tag);
    try { await fn(); } finally { setDownloading(null); }
  }

  async function quickResultsByDay(dayKey: string, label: string, format: Format) {
    const list = matches
      .filter((m) => belgradeDateKey(m.kickoff_at) === dayKey)
      .sort((a, b) => (a.kickoff_at ?? "").localeCompare(b.kickoff_at ?? ""));
    if (list.length === 0) return;
    await postResultsList(list, format, label.toUpperCase(), "Mečevi dana", `results-${dayKey}`);
  }

  async function quickAllStandings(format: Format) {
    if (standings.length === 0) return;
    await postStandingsList(standings, format, "tabele");
  }

  async function downloadPoster(kind: PosterKind, format: Format) {
    const tag = `${kind}-${format}`;
    setDownloading(tag);
    try {
      if (kind === "results") {
        const baseSlug =
          resultsMode === "round"
            ? `results-${round?.name ?? "export"}`
            : `results-${selectedDay}`;
        await postResultsList(exportMatches, format, effectiveTitle(), effectiveSubtitle(), baseSlug);
      } else if (kind === "standings") {
        await postStandingsList(exportStandings, format, "standings");
      } else if (kind === "bracket") {
        // Filter out R16 round when admin chose abbreviated mode and we have
        // 16 teams.  Re-index remaining rounds so the poster sees round 0 = QF.
        const skipFirstRound = has16Teams && !includeR16;
        const sourceRounds = skipFirstRound ? knockoutRounds.slice(1) : knockoutRounds;
        const allowedRoundIds = new Set(sourceRounds.map((r) => r.id));
        const sourceMatches = bracketMatches.filter((m) => allowedRoundIds.has(m.round_id));
        const reindex = new Map<string, number>();
        sourceRounds.forEach((r, i) => reindex.set(r.id, i));

        const buildPayload = (l: "full" | "left" | "right") => ({
          kind,
          format,
          bracket: {
            rounds: sourceRounds.map((r) => ({
              name: r.name,
              round_index: reindex.get(r.id) ?? 0,
            })),
            matches: sourceMatches.map((m) => ({
              id: m.id,
              bracket_position: m.bracket_position!,
              round_name: sourceRounds.find((r) => r.id === m.round_id)?.name ?? "",
              round_index: reindex.get(m.round_id) ?? 0,
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
            layout: l,
          },
        });

        // Split into 2 images when the bracket we're rendering has 8 first-round
        // matches (i.e. 16 teams from R16). Otherwise single mirror image.
        const firstRoundCount =
          sourceRounds.length > 0
            ? sourceMatches.filter((m) => m.round_id === sourceRounds[0].id && m.bracket_position !== "TP").length
            : 0;
        const shouldSplit = firstRoundCount >= 8;

        if (shouldSplit) {
          for (const l of ["left", "right"] as const) {
            const ok = await fetchAndDownloadPng(
              buildPayload(l),
              `turnir-kula-bracket-${format}-${l === "left" ? "leva-strana" : "desna-strana"}.png`,
            );
            if (!ok) break;
            await new Promise((r) => setTimeout(r, 700));
          }
        } else {
          await fetchAndDownloadPng(buildPayload("full"), `turnir-kula-bracket-${format}.png`);
        }
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

  // Belgrade-local "today" / "yesterday" / "tomorrow" — used for the quick
  // day buttons. Shifting via UTC midnight keeps the result independent of
  // the admin's local timezone.
  const todayKey = useMemo(() => belgradeDateKey(new Date().toISOString()) ?? "", []);
  const yesterdayKey = useMemo(() => shiftDayKey(todayKey, -1), [todayKey]);
  const tomorrowKey = useMemo(() => shiftDayKey(todayKey, 1), [todayKey]);
  const countForDay = (key: string) =>
    matches.filter((m) => belgradeDateKey(m.kickoff_at) === key).length;
  const yesterdayCount = countForDay(yesterdayKey);
  const todayCount = countForDay(todayKey);
  const tomorrowCount = countForDay(tomorrowKey);

  // Free-form day picker (any tournament date, not just ±1 from today).
  const [customDay, setCustomDay] = useState<string>(todayKey);
  const customCount = countForDay(customDay);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Share2}
        title="Slike za društvene mreže"
        hint="Klikni Stori (1080×1920) ili Objava (1080×1350) i slika ti se preuzme. Po meri filteri su ispod."
        tone="blue"
      />

      {/* Quick downloads — big buttons, no filter UI */}
      <div className="grid gap-4 sm:grid-cols-2">
        <QuickDownloadCard
          title="Utakmice juče"
          subtitle={`${yesterdayCount} mečeva · ${yesterdayKey ? formatDateLabel(yesterdayKey) : ""}`}
          disabled={yesterdayCount === 0}
          downloading={downloading}
          tagBase={`q-yesterday`}
          onStori={() =>
            quickDownload(`q-yesterday-story`, () =>
              quickResultsByDay(yesterdayKey, `Utakmice ${formatDateLabel(yesterdayKey)}`, "story"),
            )
          }
          onPost={() =>
            quickDownload(`q-yesterday-post`, () =>
              quickResultsByDay(yesterdayKey, `Utakmice ${formatDateLabel(yesterdayKey)}`, "post"),
            )
          }
        />
        <QuickDownloadCard
          title="Utakmice danas"
          subtitle={`${todayCount} mečeva · ${todayKey ? formatDateLabel(todayKey) : ""}`}
          disabled={todayCount === 0}
          downloading={downloading}
          tagBase={`q-today`}
          onStori={() =>
            quickDownload(`q-today-story`, () =>
              quickResultsByDay(todayKey, `Utakmice ${formatDateLabel(todayKey)}`, "story"),
            )
          }
          onPost={() =>
            quickDownload(`q-today-post`, () =>
              quickResultsByDay(todayKey, `Utakmice ${formatDateLabel(todayKey)}`, "post"),
            )
          }
        />
        <QuickDownloadCard
          title="Utakmice sutra"
          subtitle={`${tomorrowCount} mečeva · ${tomorrowKey ? formatDateLabel(tomorrowKey) : ""}`}
          disabled={tomorrowCount === 0}
          downloading={downloading}
          tagBase={`q-tomorrow`}
          onStori={() =>
            quickDownload(`q-tomorrow-story`, () =>
              quickResultsByDay(tomorrowKey, `Utakmice ${formatDateLabel(tomorrowKey)}`, "story"),
            )
          }
          onPost={() =>
            quickDownload(`q-tomorrow-post`, () =>
              quickResultsByDay(tomorrowKey, `Utakmice ${formatDateLabel(tomorrowKey)}`, "post"),
            )
          }
        />
        {/* Free-form date picker — admin selects any day and downloads
            the slika za taj datum. Useful for past weekends or any single
            date not covered by yesterday/today/tomorrow. */}
        <div className="card flex flex-col gap-4 !p-5 sm:!p-6">
          <div>
            <h3 className="font-bold text-2xl leading-tight">Utakmice za datum</h3>
            <div className="text-sm text-zinc-400 mt-1">
              {customCount} mečeva {customDay ? `· ${formatDateLabel(customDay)}` : ""}
            </div>
          </div>
          <input
            type="date"
            className="input"
            value={customDay}
            onChange={(e) => setCustomDay(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3 mt-auto">
            <button
              onClick={() =>
                quickDownload("q-custom-story", () =>
                  quickResultsByDay(customDay, `Utakmice ${formatDateLabel(customDay)}`, "story"),
                )
              }
              disabled={customCount === 0 || !!downloading}
              className="btn-primary !py-5 text-lg font-bold"
            >
              {downloading === "q-custom-story" ? "..." : "Stori"}
            </button>
            <button
              onClick={() =>
                quickDownload("q-custom-post", () =>
                  quickResultsByDay(customDay, `Utakmice ${formatDateLabel(customDay)}`, "post"),
                )
              }
              disabled={customCount === 0 || !!downloading}
              className="btn-secondary !py-5 text-lg font-bold"
            >
              {downloading === "q-custom-post" ? "..." : "Objava"}
            </button>
          </div>
        </div>
        <QuickDownloadCard
          title="Sve tabele"
          subtitle={`${standings.length} ${standings.length === 1 ? "grupa" : "grupa"}`}
          disabled={standings.length === 0}
          downloading={downloading}
          tagBase={`q-tables`}
          onStori={() => quickDownload(`q-tables-story`, () => quickAllStandings("story"))}
          onPost={() => quickDownload(`q-tables-post`, () => quickAllStandings("post"))}
        />
        <QuickDownloadCard
          title="Eliminacije"
          subtitle={hasBracket ? (has16Teams && includeR16 ? "2 slike po formatu" : "1 slika") : "nema kostura"}
          disabled={!hasBracket}
          downloading={downloading}
          tagBase={`bracket`}
          onStori={() => downloadPoster("bracket", "story")}
          onPost={() => downloadPoster("bracket", "post")}
        />
        <QuickDownloadCard
          title="Strelci"
          subtitle={`Top ${Math.min(10, scorers.length)}`}
          disabled={scorers.length === 0}
          downloading={downloading}
          tagBase={`scorers`}
          onStori={() => downloadPoster("scorers", "story")}
          onPost={() => downloadPoster("scorers", "post")}
        />
      </div>

      <div className="border-t border-zinc-800 pt-3 mt-2">
        <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2">
          Po meri (sa filterima)
        </div>
      </div>

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
          subtitle={
            hasBracket
              ? has16Teams && includeR16
                ? "16 timova · 2 slike"
                : "1 slika"
              : "nema kostura"
          }
          disabled={!hasBracket}
          downloading={downloading}
          kind="bracket"
          onDownload={downloadPoster}
        >
          {hasBracket && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={includeThirdPlaceBracket}
                  onChange={(e) => setIncludeThirdPlaceBracket(e.target.checked)}
                />
                Uključi meč za 3. mesto
              </label>
              {has16Teams && allR16Finished && (
                <label className="flex items-center gap-2 text-sm cursor-pointer text-zinc-300">
                  <input
                    type="checkbox"
                    checked={includeR16}
                    onChange={(e) => setIncludeR16(e.target.checked)}
                  />
                  Uključi osminu finala (sa rezultatima)
                </label>
              )}
              {has16Teams && includeR16 && (
                <p className="text-[11px] text-zinc-500">
                  16 timova → automatski 2 slike (leva i desna strana, finale i 3. mesto u sredini).
                </p>
              )}
            </div>
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

function shiftDayKey(yyyymmdd: string, days: number): string {
  if (!yyyymmdd) return "";
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
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

function QuickDownloadCard({
  title,
  subtitle,
  disabled,
  downloading,
  tagBase,
  onStori,
  onPost,
}: {
  title: string;
  subtitle: string;
  disabled: boolean;
  downloading: string | null;
  /** Prefix matching the `tag` passed to setDownloading() so the right
   *  button can show its loading state. */
  tagBase: string;
  onStori: () => void;
  onPost: () => void;
}) {
  const storiTag = `${tagBase}-story`;
  const postTag = `${tagBase}-post`;
  return (
    <div className="card flex flex-col gap-4 !p-5 sm:!p-6">
      <div>
        <h3 className="font-bold text-2xl leading-tight">{title}</h3>
        <div className="text-sm text-zinc-400 mt-1">{subtitle}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-auto">
        <button
          onClick={onStori}
          disabled={disabled || !!downloading}
          className="btn-primary !py-5 text-lg font-bold"
        >
          {downloading === storiTag ? "..." : "Stori"}
        </button>
        <button
          onClick={onPost}
          disabled={disabled || !!downloading}
          className="btn-secondary !py-5 text-lg font-bold"
        >
          {downloading === postTag ? "..." : "Objava"}
        </button>
      </div>
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
