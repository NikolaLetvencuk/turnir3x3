"use client";

import { forwardRef, useMemo, useRef, useState } from "react";
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

// Instagram Story / Reel: 1080 × 1920 (9:16)
const IG_WIDTH = 1080;
const IG_HEIGHT = 1920;
const PREVIEW_SCALE = 0.22;

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
  const initialRoundId = rounds.find((r) => r.status === "finished")?.id ?? rounds[0]?.id ?? "";
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

  const resultsRef = useRef<HTMLDivElement>(null);
  const standingsRef = useRef<HTMLDivElement>(null);
  const scorersRef = useRef<HTMLDivElement>(null);

  async function downloadFrom(
    el: HTMLDivElement | null,
    kind: PosterKind,
    format: "png" | "pdf",
  ) {
    if (!el) return;
    const tag = `${kind}-${format}`;
    setDownloading(tag);
    try {
      // Make sure web fonts are ready before capture so layout doesn't shift.
      if (typeof document !== "undefined" && (document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: format === "pdf" ? 1.5 : 1,
        useCORS: true,
        logging: false,
        width: IG_WIDTH,
        height: IG_HEIGHT,
        windowWidth: IG_WIDTH,
        windowHeight: IG_HEIGHT,
      });
      const baseName = `turnir-kula-${kind}-${round?.name ?? "export"}`
        .replace(/\s+/g, "-")
        .toLowerCase();
      if (format === "png") {
        const link = document.createElement("a");
        link.download = `${baseName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const imgRatio = canvas.height / canvas.width;
        const drawW = pageW - 16;
        const drawH = drawW * imgRatio;
        const x = (pageW - drawW) / 2;
        const y = Math.min(8, (pageH - drawH) / 2);
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, y, drawW, drawH);
        pdf.save(`${baseName}.pdf`);
      }
    } finally {
      setDownloading(null);
    }
  }

  const resultsProps = {
    title: resultsTitle || round?.name || "Turnir Kula",
    subtitle: round?.stage === "knockout" ? "Eliminacije" : "Grupna faza",
    matches: exportMatches,
  };
  const standingsProps = { standings };
  const scorersProps = { scorers };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Export</h1>
        <p className="text-sm text-zinc-500">
          Tri zasebna postera u Instagram Story / Reel formatu (1080×1920, 9:16). Sve renderuje browser.
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
                    <input
                      type="checkbox"
                      checked={selectedMatchIds.has(m.id)}
                      onChange={() => toggleMatch(m.id)}
                    />
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

      {/* Three poster cards (each with its own preview + buttons) */}
      <div className="grid lg:grid-cols-3 gap-4">
        <PosterCard
          title="Rezultati"
          subtitle={`${exportMatches.length} mečeva`}
          disabled={exportMatches.length === 0}
          downloading={downloading}
          downloadTag="results"
          onDownload={(fmt) => downloadFrom(resultsRef.current, "results", fmt)}
        >
          <ScaledPreview>
            <ResultsPoster {...resultsProps} />
          </ScaledPreview>
        </PosterCard>

        <PosterCard
          title="Tabele"
          subtitle={`${standings.length} grupa`}
          disabled={standings.length === 0}
          downloading={downloading}
          downloadTag="standings"
          onDownload={(fmt) => downloadFrom(standingsRef.current, "standings", fmt)}
        >
          <ScaledPreview>
            <StandingsPoster {...standingsProps} />
          </ScaledPreview>
        </PosterCard>

        <PosterCard
          title="Strelci"
          subtitle={`Top ${Math.min(10, scorers.length)}`}
          disabled={scorers.length === 0}
          downloading={downloading}
          downloadTag="scorers"
          onDownload={(fmt) => downloadFrom(scorersRef.current, "scorers", fmt)}
        >
          <ScaledPreview>
            <ScorersPoster {...scorersProps} />
          </ScaledPreview>
        </PosterCard>
      </div>

      {/* Off-screen capture targets — rendered at native 1080×1920 with no transforms
          so html2canvas measures positions correctly. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: -100000,
          width: IG_WIDTH * 3,
          pointerEvents: "none",
        }}
      >
        <ResultsPoster ref={resultsRef} {...resultsProps} />
        <StandingsPoster ref={standingsRef} {...standingsProps} />
        <ScorersPoster ref={scorersRef} {...scorersProps} />
      </div>
    </div>
  );
}

/* ============================ HELPERS ============================ */

function formatScore(m: ExportMatch): string {
  const base = `${m.home_score} : ${m.away_score}`;
  if (m.home_pen != null && m.away_pen != null) return `${base} (p ${m.home_pen}-${m.away_pen})`;
  return base;
}

function PosterCard({
  title,
  subtitle,
  disabled,
  downloading,
  downloadTag,
  onDownload,
  children,
}: {
  title: string;
  subtitle: string;
  disabled: boolean;
  downloading: string | null;
  downloadTag: PosterKind;
  onDownload: (fmt: "png" | "pdf") => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-zinc-500">{subtitle}</span>
      </div>
      {children}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onDownload("png")}
          disabled={disabled || !!downloading}
          className="btn-primary !py-2 text-xs sm:text-sm"
        >
          {downloading === `${downloadTag}-png` ? "..." : "PNG"}
        </button>
        <button
          onClick={() => onDownload("pdf")}
          disabled={disabled || !!downloading}
          className="btn-secondary !py-2 text-xs sm:text-sm"
        >
          {downloading === `${downloadTag}-pdf` ? "..." : "PDF"}
        </button>
      </div>
    </div>
  );
}

function ScaledPreview({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: IG_WIDTH * PREVIEW_SCALE,
        height: IG_HEIGHT * PREVIEW_SCALE,
        overflow: "hidden",
      }}
      className="mx-auto rounded-lg border border-zinc-200 shadow-sm"
    >
      <div
        style={{
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: "top left",
          width: IG_WIDTH,
          height: IG_HEIGHT,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ============================ POSTER FRAME ============================ */

function PosterFrame({
  heading,
  subheading,
  children,
}: {
  heading: string;
  subheading: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: IG_WIDTH,
        height: IG_HEIGHT,
        background:
          "radial-gradient(circle at 15% 0%, #2563eb 0%, transparent 45%), " +
          "radial-gradient(circle at 90% 100%, #60a5fa 0%, transparent 35%), " +
          "linear-gradient(180deg, #060c24 0%, #0c1a3e 100%)",
        color: "#ffffff",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: "120px 80px 100px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Brand row */}
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <div
          style={{
            fontSize: 28,
            letterSpacing: 14,
            opacity: 0.75,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {subheading}
        </div>
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            marginTop: 18,
            lineHeight: 1,
            letterSpacing: -3,
          }}
        >
          {heading}
        </div>
        <div
          style={{
            margin: "32px auto 0",
            width: 120,
            height: 6,
            background: "#60a5fa",
            borderRadius: 3,
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          minHeight: 0,
        }}
      >
        {children}
      </div>

      <div
        style={{
          marginTop: 32,
          textAlign: "center",
          fontSize: 26,
          opacity: 0.6,
          letterSpacing: 6,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        TURNIR KULA · @turnir3x3
      </div>
    </div>
  );
}

/* ============================ RESULTS POSTER ============================ */

const ResultsPoster = forwardRef<HTMLDivElement, { title: string; subtitle: string; matches: ExportMatch[] }>(
  function ResultsPoster({ title, subtitle, matches }, ref) {
    return (
      <div ref={ref}>
        <PosterFrame heading={title.toUpperCase()} subheading={subtitle}>
          {matches.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 36 }}>
              Nijedan meč nije izabran.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, justifyContent: "center" }}>
              {matches.map((m) => (
                <ResultRow key={m.id} match={m} />
              ))}
            </div>
          )}
        </PosterFrame>
      </div>
    );
  },
);

function ResultRow({ match }: { match: ExportMatch }) {
  const isFinished = match.status === "finished" || match.status === "live";
  const hasPens = match.home_pen != null && match.away_pen != null;
  const homeWin = isFinished && (match.home_score > match.away_score || (hasPens && (match.home_pen ?? 0) > (match.away_pen ?? 0)));
  const awayWin = isFinished && (match.away_score > match.home_score || (hasPens && (match.away_pen ?? 0) > (match.home_pen ?? 0)));
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 24,
        padding: "26px 36px",
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}
    >
      <TeamSide team={match.home_team} align="left" dim={isFinished && !homeWin && !(match.home_score === match.away_score && !hasPens)} />
      <div style={{ textAlign: "center", flexShrink: 0, minWidth: 260 }}>
        <div style={{ fontSize: 68, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: -1 }}>
          {isFinished ? `${match.home_score} : ${match.away_score}` : "vs"}
        </div>
        {hasPens && (
          <div style={{ fontSize: 22, opacity: 0.85, marginTop: 10, fontWeight: 700 }}>
            penali {match.home_pen}-{match.away_pen}
          </div>
        )}
      </div>
      <TeamSide team={match.away_team} align="right" dim={isFinished && !awayWin && !(match.home_score === match.away_score && !hasPens)} />
    </div>
  );
}

function TeamSide({ team, align, dim }: { team: TeamLite | null; align: "left" | "right"; dim: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 22,
        flexDirection: align === "right" ? "row-reverse" : "row",
        opacity: dim ? 0.55 : 1,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <CrestSvg team={team} size={92} />
      </div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 800,
          textAlign: align,
          lineHeight: 1.1,
          flex: 1,
          minWidth: 0,
          wordBreak: "break-word",
        }}
      >
        {team?.name ?? "?"}
      </div>
    </div>
  );
}

/* ============================ STANDINGS POSTER ============================ */

const StandingsPoster = forwardRef<HTMLDivElement, { standings: GroupStandings[] }>(
  function StandingsPoster({ standings }, ref) {
    const useTwoCols = standings.length >= 3;
    return (
      <div ref={ref}>
        <PosterFrame heading="TABELE" subheading="Grupna faza">
          {standings.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 36 }}>
              Nema podataka.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: useTwoCols ? "1fr 1fr" : "1fr",
                gap: 24,
                alignContent: "start",
              }}
            >
              {standings.map((g) => (
                <GroupTable key={g.group_id} group={g} compact={useTwoCols} />
              ))}
            </div>
          )}
        </PosterFrame>
      </div>
    );
  },
);

function GroupTable({ group, compact }: { group: GroupStandings; compact: boolean }) {
  const cellFontSize = compact ? 28 : 38;
  const headerFontSize = compact ? 18 : 22;
  const crestSize = compact ? 36 : 52;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 24,
        padding: compact ? 28 : 40,
      }}
    >
      <div
        style={{
          fontSize: compact ? 36 : 52,
          fontWeight: 900,
          marginBottom: 18,
          letterSpacing: -1,
        }}
      >
        {group.group_name}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ opacity: 0.55, fontSize: headerFontSize, textTransform: "uppercase", letterSpacing: 2 }}>
            <th style={{ textAlign: "left", padding: "4px 4px", width: 50 }}>#</th>
            <th style={{ textAlign: "left", padding: "4px 8px" }}>Tim</th>
            <th style={{ textAlign: "right", padding: "4px 8px", width: 70 }}>O</th>
            <th style={{ textAlign: "right", padding: "4px 8px", width: 90 }}>GR</th>
            <th style={{ textAlign: "right", padding: "4px 8px", width: 100 }}>Bod</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((r, i) => {
            const top2 = i < 2;
            return (
              <tr
                key={r.team_id}
                style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)" }}
              >
                <td style={{ padding: "16px 4px", fontSize: cellFontSize, opacity: top2 ? 1 : 0.55, fontWeight: 800 }}>
                  {i + 1}
                </td>
                <td style={{ padding: "16px 8px", fontSize: cellFontSize }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <CrestSvg
                      team={{ name: r.team_name, short_name: r.short_name, primary_color: r.primary_color, secondary_color: r.secondary_color }}
                      size={crestSize}
                    />
                    <span style={{ fontWeight: 700 }}>{r.team_name}</span>
                  </div>
                </td>
                <td style={{ padding: "16px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: cellFontSize, opacity: 0.75 }}>{r.played}</td>
                <td style={{ padding: "16px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: cellFontSize, opacity: 0.75 }}>{formatGD(r.goal_diff)}</td>
                <td style={{ padding: "16px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: cellFontSize + 4, fontWeight: 900 }}>{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatGD(gd: number): string {
  if (gd > 0) return `+${gd}`;
  return String(gd);
}

/* ============================ SCORERS POSTER ============================ */

const ScorersPoster = forwardRef<HTMLDivElement, { scorers: TopScorerRow[] }>(
  function ScorersPoster({ scorers }, ref) {
    return (
      <div ref={ref}>
        <PosterFrame heading="STRELCI" subheading="Najbolji">
          {scorers.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 36 }}>
              Još nema strelaca.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {scorers.slice(0, 10).map((s, i) => (
                <ScorerRow key={s.player_id} scorer={s} rank={i + 1} />
              ))}
            </div>
          )}
        </PosterFrame>
      </div>
    );
  },
);

function ScorerRow({ scorer, rank }: { scorer: TopScorerRow; rank: number }) {
  const top3 = rank <= 3;
  const rankBg = rank === 1 ? "#facc15" : rank === 2 ? "#cbd5e1" : rank === 3 ? "#f59e0b" : "rgba(255,255,255,0.12)";
  const rankColor = rank <= 3 ? "#0c1432" : "#ffffff";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        background: top3 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
        border: top3 ? "2px solid rgba(250,204,21,0.6)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: 22,
        padding: "20px 28px",
      }}
    >
      <div
        style={{
          background: rankBg,
          color: rankColor,
          width: 80,
          height: 80,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 36,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            lineHeight: 1.1,
            wordBreak: "break-word",
          }}
        >
          {scorer.player_name}
        </div>
        <div style={{ fontSize: 26, opacity: 0.65, marginTop: 6 }}>{scorer.team_name ?? "—"}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 64, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{scorer.goals}</div>
        <div style={{ fontSize: 18, opacity: 0.6, marginTop: 6, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
          golova
        </div>
      </div>
    </div>
  );
}

/* ============================ CREST ============================ */

function CrestSvg({
  team,
  size,
}: {
  team: { name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null } | null;
  size: number;
}) {
  if (!team) return <div style={{ width: size, height: size }} />;
  return (
    <TeamCrest
      name={team.name}
      shortName={team.short_name}
      primaryColor={team.primary_color}
      secondaryColor={team.secondary_color}
      size={size}
    />
  );
}
