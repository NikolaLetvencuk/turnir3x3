"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { TeamCrest } from "@/components/TeamCrest";
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

const IG_WIDTH = 1080;
const IG_HEIGHT = 1350;

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
  const initialRoundId = rounds.find((r) => r.status === "finished")?.id ?? rounds[0]?.id ?? "";
  const [selectedRoundId, setSelectedRoundId] = useState<string>(initialRoundId);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(
    () => new Set(matches.filter((m) => m.round_id === initialRoundId).map((m) => m.id)),
  );
  const [includeStandings, setIncludeStandings] = useState(true);
  const [includeScorers, setIncludeScorers] = useState(false);
  const [titleOverride, setTitleOverride] = useState("");
  const [downloading, setDownloading] = useState<null | "png" | "pdf">(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const round = rounds.find((r) => r.id === selectedRoundId) ?? null;
  const roundMatches = useMemo(
    () => matches.filter((m) => m.round_id === selectedRoundId),
    [matches, selectedRoundId],
  );

  // Default-select all matches when round changes
  function changeRound(id: string) {
    setSelectedRoundId(id);
    const ms = matches.filter((m) => m.round_id === id);
    setSelectedMatchIds(new Set(ms.map((m) => m.id)));
  }

  const exportMatches = roundMatches.filter((m) => selectedMatchIds.has(m.id));

  function toggleMatch(id: string) {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function downloadPng() {
    if (!previewRef.current) return;
    setDownloading("png");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#ffffff",
        scale: 1,
        useCORS: true,
        width: IG_WIDTH,
        height: IG_HEIGHT,
        windowWidth: IG_WIDTH,
        windowHeight: IG_HEIGHT,
      });
      const link = document.createElement("a");
      link.download = `turnir-kula-${round?.name ?? "export"}.png`.replace(/\s+/g, "-").toLowerCase();
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setDownloading(null);
    }
  }

  async function downloadPdf() {
    if (!previewRef.current) return;
    setDownloading("pdf");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#ffffff",
        scale: 1.5,
        useCORS: true,
        width: IG_WIDTH,
        height: IG_HEIGHT,
        windowWidth: IG_WIDTH,
        windowHeight: IG_HEIGHT,
      });
      // A4 portrait: 210 × 297 mm. Fit the 1080×1350 image preserving aspect.
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgRatio = canvas.height / canvas.width;
      const drawW = pageW - 16;
      const drawH = drawW * imgRatio;
      const x = (pageW - drawW) / 2;
      const y = Math.min(8, (pageH - drawH) / 2);
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, y, drawW, drawH);
      pdf.save(`turnir-kula-${round?.name ?? "export"}.pdf`.replace(/\s+/g, "-").toLowerCase());
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Export rezultata i tabela</h1>

      {/* Filters */}
      <div className="card space-y-3">
        <div>
          <label className="text-xs text-zinc-600 block mb-1">Naslov (opciono)</label>
          <input
            className="input"
            placeholder={defaultTitle(round)}
            value={titleOverride}
            onChange={(e) => setTitleOverride(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-zinc-600 block mb-1">Kolo</label>
          <select className="input" value={selectedRoundId} onChange={(e) => changeRound(e.target.value)}>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.status === "finished" ? "✓" : r.status === "active" ? "(uživo)" : ""}
              </option>
            ))}
          </select>
        </div>

        {roundMatches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-600">Mečevi ({selectedMatchIds.size} / {roundMatches.length})</label>
              <div className="text-xs flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMatchIds(new Set(roundMatches.map((m) => m.id)))}
                  className="text-blue-700 hover:underline"
                >
                  Sve
                </button>
                <span className="text-zinc-300">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedMatchIds(new Set())}
                  className="text-blue-700 hover:underline"
                >
                  Nijedan
                </button>
              </div>
            </div>
            <ul className="space-y-1 max-h-64 overflow-y-auto border border-zinc-200 rounded-md p-2">
              {roundMatches.map((m) => (
                <li key={m.id}>
                  <label className="flex items-center gap-2 text-sm hover:bg-zinc-50 rounded px-2 py-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMatchIds.has(m.id)}
                      onChange={() => toggleMatch(m.id)}
                    />
                    <span className="flex-1 truncate">{m.home_team?.name ?? "?"} vs {m.away_team?.name ?? "?"}</span>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {m.status === "finished" || m.status === "live"
                        ? formatScore(m)
                        : "—"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeStandings} onChange={(e) => setIncludeStandings(e.target.checked)} />
            Tabele grupa
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeScorers} onChange={(e) => setIncludeScorers(e.target.checked)} />
            Top strelci
          </label>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={downloadPng}
            disabled={!!downloading}
            className="btn-primary"
          >
            {downloading === "png" ? "Renderujem…" : "Skini sliku (Instagram 1080×1350)"}
          </button>
          <button
            onClick={downloadPdf}
            disabled={!!downloading}
            className="btn-secondary"
          >
            {downloading === "pdf" ? "Renderujem…" : "Skini PDF"}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Generisanje ide u browseru — sve što vidiš u pregledu ispod tačno je ono što ide u fajl.
        </p>
      </div>

      {/* Preview pane — fixed 1080×1350 px so the captured canvas is the exact IG dimensions.
          We scale it visually via CSS transform so it fits the admin's screen. */}
      <div>
        <div className="text-xs text-zinc-500 mb-2">Pregled (skalirano):</div>
        <div
          className="mx-auto"
          style={{
            width: IG_WIDTH * 0.42,
            height: IG_HEIGHT * 0.42,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              transform: "scale(0.42)",
              transformOrigin: "top left",
              width: IG_WIDTH,
              height: IG_HEIGHT,
            }}
          >
            <ExportPoster
              ref={previewRef}
              title={titleOverride || defaultTitle(round)}
              matches={exportMatches}
              standings={includeStandings ? standings : []}
              scorers={includeScorers ? scorers : []}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function defaultTitle(round: ExportRound | null): string {
  if (!round) return "Turnir Kula";
  return `${round.name} — Turnir Kula`;
}

function formatScore(m: ExportMatch): string {
  const base = `${m.home_score} : ${m.away_score}`;
  if (m.home_pen != null && m.away_pen != null) return `${base} (pen ${m.home_pen}-${m.away_pen})`;
  return base;
}

/* ============================ POSTER ============================ */

type ExportPosterProps = {
  title: string;
  matches: ExportMatch[];
  standings: GroupStandings[];
  scorers: TopScorerRow[];
};

const ExportPoster = forwardRef<HTMLDivElement, ExportPosterProps>(function ExportPoster(
  { title, matches, standings, scorers },
  ref,
) {
  return (
  <div
    ref={ref}
    style={{
      width: IG_WIDTH,
      height: IG_HEIGHT,
      background: "linear-gradient(180deg, #1e3a8a 0%, #1e40af 30%, #0c1a3e 100%)",
      color: "white",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: 64,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 32,
    }}
  >
    {/* Header */}
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 22, letterSpacing: 8, opacity: 0.7, textTransform: "uppercase" }}>Turnir Kula</div>
      <div style={{ fontSize: 56, fontWeight: 900, marginTop: 8, lineHeight: 1.05 }}>{title}</div>
    </div>

    {/* Matches */}
    {matches.length > 0 && (
      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 24, padding: 24, backdropFilter: "blur(8px)" }}>
        <div style={{ fontSize: 18, letterSpacing: 4, opacity: 0.65, textTransform: "uppercase", marginBottom: 16 }}>Rezultati</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {matches.map((m) => <MatchRow key={m.id} match={m} />)}
        </div>
      </div>
    )}

    {/* Standings */}
    {standings.length > 0 && (
      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 24, padding: 24 }}>
        <div style={{ fontSize: 18, letterSpacing: 4, opacity: 0.65, textTransform: "uppercase", marginBottom: 16 }}>Tabele</div>
        <div style={{ display: "grid", gridTemplateColumns: standings.length > 2 ? "1fr 1fr" : "1fr", gap: 16 }}>
          {standings.map((g) => <StandingsBlock key={g.group_id} group={g} />)}
        </div>
      </div>
    )}

    {/* Scorers */}
    {scorers.length > 0 && (
      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 24, padding: 24 }}>
        <div style={{ fontSize: 18, letterSpacing: 4, opacity: 0.65, textTransform: "uppercase", marginBottom: 12 }}>Top strelci</div>
        <table style={{ width: "100%", fontSize: 22 }}>
          <tbody>
            {scorers.slice(0, 8).map((s, i) => (
              <tr key={s.player_id}>
                <td style={{ padding: "4px 0", opacity: 0.5, width: 40 }}>{i + 1}.</td>
                <td style={{ padding: "4px 0", fontWeight: 600 }}>{s.player_name}</td>
                <td style={{ padding: "4px 0", opacity: 0.7 }}>{s.team_name ?? "—"}</td>
                <td style={{ padding: "4px 0", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{s.goals} ⚽</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* Footer */}
    <div style={{ marginTop: "auto", textAlign: "center", fontSize: 18, opacity: 0.5 }}>
      turnir3x3.vercel.app
    </div>
  </div>
  );
});

function MatchRow({ match }: { match: ExportMatch }) {
  const isFinished = match.status === "finished";
  const hasPens = match.home_pen != null && match.away_pen != null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 16,
        background: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        padding: "12px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <CrestPng team={match.home_team} size={48} />
        <div style={{ fontSize: 24, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {match.home_team?.name ?? "?"}
        </div>
      </div>
      <div style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
        <div style={{ fontSize: 32, fontWeight: 900 }}>
          {isFinished || match.status === "live" ? `${match.home_score} : ${match.away_score}` : "vs"}
        </div>
        {hasPens && (
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 2 }}>pen {match.home_pen}-{match.away_pen}</div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end", minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
          {match.away_team?.name ?? "?"}
        </div>
        <CrestPng team={match.away_team} size={48} />
      </div>
    </div>
  );
}

function StandingsBlock({ group }: { group: GroupStandings }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{group.group_name}</div>
      <table style={{ width: "100%", fontSize: 16 }}>
        <thead>
          <tr style={{ opacity: 0.55, fontSize: 11, textTransform: "uppercase" }}>
            <th style={{ textAlign: "left", padding: "2px 4px" }}>#</th>
            <th style={{ textAlign: "left", padding: "2px 4px" }}>Tim</th>
            <th style={{ textAlign: "right", padding: "2px 4px" }}>O</th>
            <th style={{ textAlign: "right", padding: "2px 4px" }}>P</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((r, i) => (
            <tr key={r.team_id}>
              <td style={{ padding: "3px 4px", opacity: 0.5 }}>{i + 1}.</td>
              <td style={{ padding: "3px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                <CrestPng team={{ id: r.team_id, name: r.team_name, short_name: r.short_name, primary_color: r.primary_color, secondary_color: r.secondary_color }} size={20} />
                <span style={{ fontWeight: 500 }}>{r.team_name}</span>
              </td>
              <td style={{ padding: "3px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>{r.played}</td>
              <td style={{ padding: "3px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Crest rendered via inline SVG so html2canvas captures it correctly without CORS issues.
function CrestPng({
  team,
  size,
}: {
  team: TeamLite | { id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null } | null;
  size: number;
}) {
  if (!team) return <div style={{ width: size, height: size }} />;
  const primary = team.primary_color || "#1f2937";
  const secondary = team.secondary_color || "#f3f4f6";
  const initials = (team.short_name || team.name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return (
    <TeamCrest
      name={team.name}
      shortName={initials}
      primaryColor={primary}
      secondaryColor={secondary}
      size={size}
    />
  );
}
