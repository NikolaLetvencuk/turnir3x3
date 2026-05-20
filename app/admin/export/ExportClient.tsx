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

const IG_WIDTH = 1080;
const IG_HEIGHT = 1350;
const PREVIEW_SCALE = 0.36;

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
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: format === "pdf" ? 1.5 : 1,
        useCORS: true,
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Export</h1>
        <p className="text-sm text-zinc-500">Tri zasebna postera: rezultati, tabele i strelci. Sve renderuje browser — Instagram format 1080×1350.</p>
      </div>

      {/* Round + match filters (used by Results poster only) */}
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

      {/* Three poster cards */}
      <div className="grid lg:grid-cols-3 gap-4">
        <PosterCard
          title="Rezultati"
          subtitle={`${exportMatches.length} mečeva`}
          disabled={exportMatches.length === 0}
          downloading={downloading}
          downloadTag="results"
          onDownload={(fmt) => downloadFrom(resultsRef.current, "results", fmt)}
        >
          <PreviewContainer>
            <ResultsPoster
              ref={resultsRef}
              title={resultsTitle || round?.name || "Turnir Kula"}
              subtitle={round?.stage === "knockout" ? "Eliminacije · Turnir Kula" : "Grupna faza · Turnir Kula"}
              matches={exportMatches}
            />
          </PreviewContainer>
        </PosterCard>

        <PosterCard
          title="Tabele"
          subtitle={`${standings.length} ${standings.length === 1 ? "grupa" : "grupa"}`}
          disabled={standings.length === 0}
          downloading={downloading}
          downloadTag="standings"
          onDownload={(fmt) => downloadFrom(standingsRef.current, "standings", fmt)}
        >
          <PreviewContainer>
            <StandingsPoster ref={standingsRef} standings={standings} />
          </PreviewContainer>
        </PosterCard>

        <PosterCard
          title="Strelci"
          subtitle={`Top ${Math.min(10, scorers.length)}`}
          disabled={scorers.length === 0}
          downloading={downloading}
          downloadTag="scorers"
          onDownload={(fmt) => downloadFrom(scorersRef.current, "scorers", fmt)}
        >
          <PreviewContainer>
            <ScorersPoster ref={scorersRef} scorers={scorers} />
          </PreviewContainer>
        </PosterCard>
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

function PreviewContainer({ children }: { children: React.ReactNode }) {
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
        background: "linear-gradient(160deg, #0b1437 0%, #1d4ed8 60%, #0b1437 100%)",
        color: "white",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "72px 64px 56px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative glow */}
      <div
        style={{
          position: "absolute",
          top: -180,
          right: -180,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "rgba(59, 130, 246, 0.35)",
          filter: "blur(120px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -200,
          left: -150,
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: "rgba(96, 165, 250, 0.25)",
          filter: "blur(120px)",
        }}
      />

      {/* Brand row */}
      <div style={{ position: "relative", textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 18, letterSpacing: 10, opacity: 0.6, textTransform: "uppercase", fontWeight: 600 }}>
          {subheading}
        </div>
        <div style={{ fontSize: 72, fontWeight: 900, marginTop: 12, lineHeight: 1, letterSpacing: -2 }}>
          {heading}
        </div>
        <div
          style={{
            margin: "20px auto 0",
            width: 80,
            height: 4,
            background: "linear-gradient(90deg, transparent, #60a5fa, transparent)",
            borderRadius: 2,
          }}
        />
      </div>

      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", gap: 20, minHeight: 0 }}>
        {children}
      </div>

      <div
        style={{
          position: "relative",
          marginTop: 24,
          textAlign: "center",
          fontSize: 18,
          opacity: 0.45,
          letterSpacing: 3,
          textTransform: "uppercase",
        }}
      >
        turnir3x3.vercel.app
      </div>
    </div>
  );
}

/* ============================ RESULTS POSTER ============================ */

const ResultsPoster = forwardRef<HTMLDivElement, { title: string; subtitle: string; matches: ExportMatch[] }>(
  function ResultsPoster({ title, subtitle, matches }, ref) {
    return (
      <div ref={ref}>
        <PosterFrame heading={title} subheading={subtitle}>
          {matches.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 28 }}>
              Nijedan meč nije izabran.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 18,
        padding: "16px 24px",
        display: "grid",
        gridTemplateColumns: "1fr 180px 1fr",
        alignItems: "center",
        gap: 16,
        backdropFilter: "blur(8px)",
      }}
    >
      <TeamSide team={match.home_team} align="left" dim={isFinished && !homeWin && !(match.home_score === match.away_score && !hasPens)} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 42, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {isFinished ? `${match.home_score} : ${match.away_score}` : "vs"}
        </div>
        {hasPens && (
          <div style={{ fontSize: 16, opacity: 0.75, marginTop: 6, fontWeight: 600 }}>
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
        gap: 14,
        flexDirection: align === "right" ? "row-reverse" : "row",
        opacity: dim ? 0.55 : 1,
        minWidth: 0,
      }}
    >
      <CrestSvg team={team} size={56} />
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          textAlign: align,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flex: 1,
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
    const useTwoCols = standings.length >= 2;
    return (
      <div ref={ref}>
        <PosterFrame heading="TABELE" subheading="Grupna faza · Turnir Kula">
          {standings.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 28 }}>
              Nema podataka za tabele.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: useTwoCols ? "1fr 1fr" : "1fr",
                gap: 18,
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
  const cellFontSize = compact ? 18 : 24;
  const headerFontSize = compact ? 11 : 13;
  const nameWidth = compact ? "auto" : "auto";
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 18,
        padding: compact ? 18 : 24,
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{ fontSize: compact ? 22 : 28, fontWeight: 800, marginBottom: 12 }}>{group.group_name}</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ opacity: 0.55, fontSize: headerFontSize, textTransform: "uppercase", letterSpacing: 1 }}>
            <th style={{ textAlign: "left", padding: "4px 4px", width: 32 }}>#</th>
            <th style={{ textAlign: "left", padding: "4px 4px", width: nameWidth }}>Tim</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>O</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>GR</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>Bod</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((r, i) => {
            const top2 = i < 2;
            return (
              <tr key={r.team_id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "8px 4px", fontSize: cellFontSize, opacity: top2 ? 1 : 0.6, fontWeight: 700 }}>{i + 1}</td>
                <td style={{ padding: "8px 4px", fontSize: cellFontSize }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CrestSvg
                      team={{ name: r.team_name, short_name: r.short_name, primary_color: r.primary_color, secondary_color: r.secondary_color }}
                      size={compact ? 28 : 36}
                    />
                    <span style={{ fontWeight: 600 }}>{r.team_name}</span>
                  </div>
                </td>
                <td style={{ padding: "8px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: cellFontSize, opacity: 0.75 }}>{r.played}</td>
                <td style={{ padding: "8px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: cellFontSize, opacity: 0.75 }}>{formatGD(r.goal_diff)}</td>
                <td style={{ padding: "8px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: cellFontSize + 2, fontWeight: 800 }}>{r.points}</td>
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
        <PosterFrame heading="STRELCI" subheading="Najbolji · Turnir Kula">
          {scorers.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 28 }}>
              Još nema strelaca.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
  const rankColor = rank <= 3 ? "#0c1432" : "white";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "64px 1fr auto",
        alignItems: "center",
        gap: 16,
        background: top3 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
        border: top3 ? "1px solid rgba(250,204,21,0.4)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: "14px 22px",
      }}
    >
      <div
        style={{
          background: rankBg,
          color: rankColor,
          width: 48,
          height: 48,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 22,
        }}
      >
        {rank}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 28, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {scorer.player_name}
        </div>
        <div style={{ fontSize: 18, opacity: 0.65, marginTop: 2 }}>{scorer.team_name ?? "—"}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 36, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{scorer.goals}</div>
        <div style={{ fontSize: 14, opacity: 0.6, marginTop: 4, letterSpacing: 2, textTransform: "uppercase" }}>golova</div>
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
