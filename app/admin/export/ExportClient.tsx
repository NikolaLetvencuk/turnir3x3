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
  const initialRoundId =
    rounds.find((r) => r.status === "finished")?.id ?? rounds[0]?.id ?? "";
  const [selectedRoundId, setSelectedRoundId] = useState<string>(initialRoundId);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(
    () => new Set(matches.filter((m) => m.round_id === initialRoundId).map((m) => m.id)),
  );
  const [resultsTitle, setResultsTitle] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const round = rounds.find((r) => r.id === selectedRoundId) ?? null;
  const roundMatches = useMemo(
    () => matches.filter((m) => m.round_id === selectedRoundId),
    [matches, selectedRoundId],
  );
  const exportMatches = roundMatches.filter((m) => selectedMatchIds.has(m.id));

  function changeRound(id: string) {
    setSelectedRoundId(id);
    setSelectedMatchIds(new Set(matches.filter((m) => m.round_id === id).map((m) => m.id)));
  }
  function toggleMatch(id: string) {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
              title: resultsTitle || round?.name || "Turnir Kula",
              subtitle: round?.stage === "knockout" ? "Eliminacije" : "Grupna faza",
              matches: exportMatches.map((m) => ({
                id: m.id,
                status: m.status,
                home_score: m.home_score,
                away_score: m.away_score,
                home_pen: m.home_pen,
                away_pen: m.away_pen,
                home_team: m.home_team,
                away_team: m.away_team,
              })),
            }
          : kind === "standings"
          ? {
              kind,
              format,
              standings: standings.map((g) => ({
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
      if (!response.ok) {
        const txt = await response.text();
        alert("Greška pri generisanju: " + txt.slice(0, 200));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `turnir-kula-${kind}-${format}-${round?.name ?? "export"}.png`
        .replace(/\s+/g, "-")
        .toLowerCase();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Export</h1>
        <p className="text-sm text-zinc-500">
          Server generiše PNG preko <code>next/og</code> (Satori) — pixel-perfect tipografija i centriranje. Story 1080×1920, Objava 1080×1350.
        </p>
      </div>

      {/* Filters */}
      <div className="card space-y-3">
        <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Filteri za &quot;Rezultati&quot;</div>
        <div className="grid sm:grid-cols-2 gap-3">
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
          <label className="block">
            <span className="text-xs text-zinc-600">Naslov (opciono)</span>
            <input
              className="input"
              placeholder={round?.name ?? "Turnir Kula"}
              value={resultsTitle}
              onChange={(e) => setResultsTitle(e.target.value)}
            />
          </label>
        </div>

        {roundMatches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-600">Mečevi ({selectedMatchIds.size} / {roundMatches.length})</span>
              <div className="text-xs flex gap-2">
                <button onClick={() => setSelectedMatchIds(new Set(roundMatches.map((m) => m.id)))} className="text-blue-700 hover:underline">Sve</button>
                <span className="text-zinc-300">·</span>
                <button onClick={() => setSelectedMatchIds(new Set())} className="text-blue-700 hover:underline">Nijedan</button>
              </div>
            </div>
            <ul className="space-y-1 max-h-64 overflow-y-auto border border-zinc-200 rounded-md p-2 bg-zinc-50">
              {roundMatches.map((m) => (
                <li key={m.id}>
                  <label className="flex items-center gap-2 text-sm hover:bg-white rounded px-2 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={selectedMatchIds.has(m.id)} onChange={() => toggleMatch(m.id)} />
                    <span className="flex-1 truncate">{m.home_team?.name ?? "?"} vs {m.away_team?.name ?? "?"}</span>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {m.status === "finished" || m.status === "live" ? formatScore(m) : "—"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Three poster cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <DownloadCard
          title="Rezultati"
          subtitle={`${exportMatches.length} mečeva`}
          disabled={exportMatches.length === 0}
          downloading={downloading}
          kind="results"
          onDownload={downloadPoster}
        />
        <DownloadCard
          title="Tabele"
          subtitle={`${standings.length} grupa`}
          disabled={standings.length === 0}
          downloading={downloading}
          kind="standings"
          onDownload={downloadPoster}
        />
        <DownloadCard
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

function formatScore(m: ExportMatch): string {
  const base = `${m.home_score} : ${m.away_score}`;
  if (m.home_pen != null && m.away_pen != null) return `${base} (p ${m.home_pen}-${m.away_pen})`;
  return base;
}

function DownloadCard({
  title,
  subtitle,
  disabled,
  downloading,
  kind,
  onDownload,
}: {
  title: string;
  subtitle: string;
  disabled: boolean;
  downloading: string | null;
  kind: PosterKind;
  onDownload: (kind: PosterKind, format: Format) => void;
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
