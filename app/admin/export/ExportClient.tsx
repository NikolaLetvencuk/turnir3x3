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

type Format = "story" | "post";
const FORMATS: Record<Format, { width: number; height: number; label: string }> = {
  story: { width: 1080, height: 1920, label: "Stori 9:16" },
  post: { width: 1080, height: 1350, label: "Objava 4:5" },
};
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

  // Off-screen capture targets — one ref per (kind × format).
  const refs: Record<PosterKind, Record<Format, React.RefObject<HTMLDivElement>>> = {
    results: { story: useRef<HTMLDivElement>(null), post: useRef<HTMLDivElement>(null) },
    standings: { story: useRef<HTMLDivElement>(null), post: useRef<HTMLDivElement>(null) },
    scorers: { story: useRef<HTMLDivElement>(null), post: useRef<HTMLDivElement>(null) },
  };

  async function downloadPng(kind: PosterKind, format: Format) {
    const el = refs[kind][format].current;
    if (!el) return;
    const tag = `${kind}-${format}-png`;
    setDownloading(tag);
    try {
      if (typeof document !== "undefined" && (document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }
      const html2canvas = (await import("html2canvas")).default;
      const { width, height } = FORMATS[format];
      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: 1,
        useCORS: true,
        logging: false,
        width, height,
        windowWidth: width, windowHeight: height,
      });
      const baseName = `turnir-kula-${kind}-${format}-${round?.name ?? "export"}`
        .replace(/\s+/g, "-").toLowerCase();
      const link = document.createElement("a");
      link.download = `${baseName}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setDownloading(null);
    }
  }

  async function downloadPdf(kind: PosterKind) {
    // PDF uses the story (9:16) variant, fit onto A4 portrait.
    const el = refs[kind].story.current;
    if (!el) return;
    const tag = `${kind}-pdf`;
    setDownloading(tag);
    try {
      if (typeof document !== "undefined" && (document as any).fonts?.ready) {
        await (document as any).fonts.ready;
      }
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const { width, height } = FORMATS.story;
      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: 1.5,
        useCORS: true,
        logging: false,
        width, height,
        windowWidth: width, windowHeight: height,
      });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgRatio = canvas.height / canvas.width;
      const drawW = pageW - 16;
      const drawH = drawW * imgRatio;
      const x = (pageW - drawW) / 2;
      const y = Math.max(0, (pageH - drawH) / 2);
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, y, drawW, Math.min(drawH, pageH));
      pdf.save(`turnir-kula-${kind}-${round?.name ?? "export"}.pdf`.replace(/\s+/g, "-").toLowerCase());
    } finally {
      setDownloading(null);
    }
  }

  const resultsProps = {
    title: resultsTitle || round?.name || "Turnir Kula",
    subtitle: round?.stage === "knockout" ? "Eliminacije" : "Grupna faza",
    matches: exportMatches,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Export</h1>
        <p className="text-sm text-zinc-500">
          Tri zasebna postera (Rezultati / Tabele / Strelci). Po posteru postoje tri downloada: Stori (1080×1920 / 9:16), Objava (1080×1350 / 4:5), PDF.
        </p>
      </div>

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

      <div className="grid lg:grid-cols-3 gap-4">
        <PosterCard
          title="Rezultati"
          subtitle={`${exportMatches.length} mečeva`}
          disabled={exportMatches.length === 0}
          downloading={downloading}
          kind="results"
          onDownloadPng={(fmt) => downloadPng("results", fmt)}
          onDownloadPdf={() => downloadPdf("results")}
        >
          <ScaledPreview format="story">
            <ResultsPoster format="story" {...resultsProps} />
          </ScaledPreview>
        </PosterCard>

        <PosterCard
          title="Tabele"
          subtitle={`${standings.length} grupa`}
          disabled={standings.length === 0}
          downloading={downloading}
          kind="standings"
          onDownloadPng={(fmt) => downloadPng("standings", fmt)}
          onDownloadPdf={() => downloadPdf("standings")}
        >
          <ScaledPreview format="story">
            <StandingsPoster format="story" standings={standings} />
          </ScaledPreview>
        </PosterCard>

        <PosterCard
          title="Strelci"
          subtitle={`Top ${Math.min(10, scorers.length)}`}
          disabled={scorers.length === 0}
          downloading={downloading}
          kind="scorers"
          onDownloadPng={(fmt) => downloadPng("scorers", fmt)}
          onDownloadPdf={() => downloadPdf("scorers")}
        >
          <ScaledPreview format="story">
            <ScorersPoster format="story" scorers={scorers} />
          </ScaledPreview>
        </PosterCard>
      </div>

      {/* Off-screen capture targets — 3 posters × 2 formats. No CSS transforms in ancestry,
          so html2canvas measures positions correctly. */}
      <div
        aria-hidden="true"
        style={{ position: "fixed", top: 0, left: -100000, pointerEvents: "none" }}
      >
        <ResultsPoster ref={refs.results.story} format="story" {...resultsProps} />
        <ResultsPoster ref={refs.results.post} format="post" {...resultsProps} />
        <StandingsPoster ref={refs.standings.story} format="story" standings={standings} />
        <StandingsPoster ref={refs.standings.post} format="post" standings={standings} />
        <ScorersPoster ref={refs.scorers.story} format="story" scorers={scorers} />
        <ScorersPoster ref={refs.scorers.post} format="post" scorers={scorers} />
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

// Single-line auto-shrink: pick a font size that lets `name` fit in `maxWidth` at ~0.55em
// per character. Bottoms out at `min`, never breaks the word across lines.
function fitFontSize(name: string, maxWidth: number, base: number, min: number = 22): number {
  if (!name) return base;
  const charW = 0.55;
  const fitted = Math.floor(maxWidth / (name.length * charW));
  return Math.max(min, Math.min(base, fitted));
}

function PosterCard({
  title,
  subtitle,
  disabled,
  downloading,
  kind,
  onDownloadPng,
  onDownloadPdf,
  children,
}: {
  title: string;
  subtitle: string;
  disabled: boolean;
  downloading: string | null;
  kind: PosterKind;
  onDownloadPng: (fmt: Format) => void;
  onDownloadPdf: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-zinc-500">{subtitle}</span>
      </div>
      {children}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button
          onClick={() => onDownloadPng("story")}
          disabled={disabled || !!downloading}
          className="btn-primary !py-2 text-xs"
        >
          {downloading === `${kind}-story-png` ? "..." : "Stori"}
        </button>
        <button
          onClick={() => onDownloadPng("post")}
          disabled={disabled || !!downloading}
          className="btn-primary !py-2 text-xs"
        >
          {downloading === `${kind}-post-png` ? "..." : "Objava"}
        </button>
        <button
          onClick={onDownloadPdf}
          disabled={disabled || !!downloading}
          className="btn-secondary !py-2 text-xs"
        >
          {downloading === `${kind}-pdf` ? "..." : "PDF"}
        </button>
      </div>
    </div>
  );
}

function ScaledPreview({ children, format }: { children: React.ReactNode; format: Format }) {
  const { width, height } = FORMATS[format];
  return (
    <div
      style={{
        width: width * PREVIEW_SCALE,
        height: height * PREVIEW_SCALE,
        overflow: "hidden",
      }}
      className="mx-auto rounded-lg border border-zinc-200 shadow-sm"
    >
      <div
        style={{
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: "top left",
          width,
          height,
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
  format,
  children,
}: {
  heading: string;
  subheading: string;
  format: Format;
  children: React.ReactNode;
}) {
  const { width, height } = FORMATS[format];
  const isStory = format === "story";
  const padding = isStory ? "120px 80px 100px" : "80px 70px 70px";
  const headingSize = isStory ? 120 : 96;
  const subheadingSize = isStory ? 28 : 24;
  const brandMargin = isStory ? 56 : 36;

  return (
    <div
      style={{
        width,
        height,
        background:
          "radial-gradient(circle at 15% 0%, #2563eb 0%, transparent 45%), " +
          "radial-gradient(circle at 90% 100%, #60a5fa 0%, transparent 35%), " +
          "linear-gradient(180deg, #060c24 0%, #0c1a3e 100%)",
        color: "#ffffff",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: brandMargin }}>
        <div
          style={{
            fontSize: subheadingSize,
            letterSpacing: 14,
            opacity: 0.75,
            textTransform: "uppercase",
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {subheading}
        </div>
        <div
          style={{
            fontSize: headingSize,
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
            margin: "26px auto 0",
            width: 120,
            height: 6,
            background: "#60a5fa",
            borderRadius: 3,
          }}
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: isStory ? 20 : 14, minHeight: 0 }}>
        {children}
      </div>

      <div
        style={{
          marginTop: isStory ? 32 : 18,
          textAlign: "center",
          fontSize: isStory ? 26 : 20,
          opacity: 0.6,
          letterSpacing: 6,
          textTransform: "uppercase",
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        TURNIR KULA · @turnir3x3
      </div>
    </div>
  );
}

/* ============================ RESULTS POSTER ============================ */

type ResultsPosterProps = { title: string; subtitle: string; matches: ExportMatch[]; format: Format };
const ResultsPoster = forwardRef<HTMLDivElement, ResultsPosterProps>(
  function ResultsPoster({ title, subtitle, matches, format }, ref) {
    return (
      <div ref={ref}>
        <PosterFrame heading={title.toUpperCase()} subheading={subtitle} format={format}>
          {matches.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 36 }}>
              Nijedan meč nije izabran.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: format === "story" ? 20 : 14, justifyContent: "center" }}>
              {matches.map((m) => (
                <ResultRow key={m.id} match={m} format={format} />
              ))}
            </div>
          )}
        </PosterFrame>
      </div>
    );
  },
);

function ResultRow({ match, format }: { match: ExportMatch; format: Format }) {
  const isStory = format === "story";
  const isFinished = match.status === "finished" || match.status === "live";
  const hasPens = match.home_pen != null && match.away_pen != null;
  const homeWin = isFinished && (match.home_score > match.away_score || (hasPens && (match.home_pen ?? 0) > (match.away_pen ?? 0)));
  const awayWin = isFinished && (match.away_score > match.home_score || (hasPens && (match.away_pen ?? 0) > (match.home_pen ?? 0)));

  const crestSize = isStory ? 80 : 64;
  const scoreSize = isStory ? 64 : 50;
  const scoreWidth = isStory ? 220 : 180;
  const baseNameSize = isStory ? 36 : 30;
  // Per-side available width = (1080 - 160 frame - 72 card - 48 gap - scoreWidth) / 2 − crest − gap
  const sideAvailable = (1080 - 160 - 72 - 48 - scoreWidth) / 2 - crestSize - 20;

  const homeName = match.home_team?.name ?? "?";
  const awayName = match.away_team?.name ?? "?";
  const homeFontSize = fitFontSize(homeName, sideAvailable, baseNameSize);
  const awayFontSize = fitFontSize(awayName, sideAvailable, baseNameSize);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 22,
        padding: isStory ? "22px 32px" : "16px 26px",
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      <TeamSide
        team={match.home_team}
        align="left"
        dim={isFinished && !homeWin && !(match.home_score === match.away_score && !hasPens)}
        crestSize={crestSize}
        fontSize={homeFontSize}
      />
      <div style={{ textAlign: "center", flexShrink: 0, width: scoreWidth }}>
        <div
          style={{
            fontSize: scoreSize,
            fontWeight: 900,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            letterSpacing: -1,
          }}
        >
          {isFinished ? `${match.home_score} : ${match.away_score}` : "vs"}
        </div>
        {hasPens && (
          <div style={{ fontSize: isStory ? 20 : 17, opacity: 0.85, marginTop: 8, fontWeight: 700, lineHeight: 1 }}>
            penali {match.home_pen}-{match.away_pen}
          </div>
        )}
      </div>
      <TeamSide
        team={match.away_team}
        align="right"
        dim={isFinished && !awayWin && !(match.home_score === match.away_score && !hasPens)}
        crestSize={crestSize}
        fontSize={awayFontSize}
      />
    </div>
  );
}

function TeamSide({
  team,
  align,
  dim,
  crestSize,
  fontSize,
}: {
  team: TeamLite | null;
  align: "left" | "right";
  dim: boolean;
  crestSize: number;
  fontSize: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexDirection: align === "right" ? "row-reverse" : "row",
        opacity: dim ? 0.55 : 1,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <CrestSvg team={team} size={crestSize} />
      </div>
      <div
        style={{
          fontSize,
          fontWeight: 800,
          textAlign: align,
          lineHeight: 1,
          flex: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {team?.name ?? "?"}
      </div>
    </div>
  );
}

/* ============================ STANDINGS POSTER ============================ */

type StandingsPosterProps = { standings: GroupStandings[]; format: Format };
const StandingsPoster = forwardRef<HTMLDivElement, StandingsPosterProps>(
  function StandingsPoster({ standings, format }, ref) {
    const useTwoCols = standings.length >= 3;
    return (
      <div ref={ref}>
        <PosterFrame heading="TABELE" subheading="Grupna faza" format={format}>
          {standings.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 36 }}>
              Nema podataka.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: useTwoCols ? "1fr 1fr" : "1fr",
                gap: format === "story" ? 24 : 18,
                alignContent: "start",
              }}
            >
              {standings.map((g) => (
                <GroupTable key={g.group_id} group={g} compact={useTwoCols} format={format} />
              ))}
            </div>
          )}
        </PosterFrame>
      </div>
    );
  },
);

function GroupTable({ group, compact, format }: { group: GroupStandings; compact: boolean; format: Format }) {
  const isStory = format === "story";
  const cellFontSize = compact ? (isStory ? 26 : 22) : (isStory ? 34 : 30);
  const pointsFontSize = cellFontSize + 4;
  const headerFontSize = compact ? 16 : (isStory ? 20 : 18);
  const crestSize = compact ? 32 : (isStory ? 46 : 40);
  const rowHeight = Math.max(crestSize + 12, cellFontSize + 16);
  const padding = compact ? (isStory ? 24 : 18) : (isStory ? 36 : 28);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 22,
        padding,
      }}
    >
      <div
        style={{
          fontSize: compact ? (isStory ? 32 : 28) : (isStory ? 46 : 38),
          fontWeight: 900,
          marginBottom: 16,
          letterSpacing: -1,
          lineHeight: 1,
        }}
      >
        {group.group_name}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ opacity: 0.55, fontSize: headerFontSize, textTransform: "uppercase", letterSpacing: 2 }}>
            <th style={{ textAlign: "left", padding: "4px 4px", width: 44 }}>#</th>
            <th style={{ textAlign: "left", padding: "4px 8px" }}>Tim</th>
            <th style={{ textAlign: "right", padding: "4px 8px", width: 60 }}>O</th>
            <th style={{ textAlign: "right", padding: "4px 8px", width: 80 }}>GR</th>
            <th style={{ textAlign: "right", padding: "4px 8px", width: 80 }}>Bod</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((r, i) => {
            const top2 = i < 2;
            return (
              <tr
                key={r.team_id}
                style={{
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
                  height: rowHeight,
                }}
              >
                <td style={{ padding: "0 4px", fontSize: cellFontSize, opacity: top2 ? 1 : 0.55, fontWeight: 800, lineHeight: 1, verticalAlign: "middle" }}>
                  {i + 1}
                </td>
                <td style={{ padding: "0 8px", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                      <CrestSvg
                        team={{ name: r.team_name, short_name: r.short_name, primary_color: r.primary_color, secondary_color: r.secondary_color }}
                        size={crestSize}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: cellFontSize,
                        fontWeight: 700,
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        minWidth: 0,
                      }}
                    >
                      {r.team_name}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "0 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: cellFontSize, opacity: 0.75, lineHeight: 1, verticalAlign: "middle" }}>
                  {r.played}
                </td>
                <td style={{ padding: "0 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: cellFontSize, opacity: 0.75, lineHeight: 1, verticalAlign: "middle" }}>
                  {formatGD(r.goal_diff)}
                </td>
                <td style={{ padding: "0 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: pointsFontSize, fontWeight: 900, lineHeight: 1, verticalAlign: "middle" }}>
                  {r.points}
                </td>
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

type ScorersPosterProps = { scorers: TopScorerRow[]; format: Format };
const ScorersPoster = forwardRef<HTMLDivElement, ScorersPosterProps>(
  function ScorersPoster({ scorers, format }, ref) {
    const isStory = format === "story";
    const max = isStory ? 10 : 8;
    return (
      <div ref={ref}>
        <PosterFrame heading="STRELCI" subheading="Najbolji" format={format}>
          {scorers.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 36 }}>
              Još nema strelaca.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: isStory ? 14 : 10 }}>
              {scorers.slice(0, max).map((s, i) => (
                <ScorerRow key={s.player_id} scorer={s} rank={i + 1} format={format} />
              ))}
            </div>
          )}
        </PosterFrame>
      </div>
    );
  },
);

function ScorerRow({ scorer, rank, format }: { scorer: TopScorerRow; rank: number; format: Format }) {
  const isStory = format === "story";
  const top3 = rank <= 3;
  const rankBg = rank === 1 ? "#facc15" : rank === 2 ? "#cbd5e1" : rank === 3 ? "#f59e0b" : "rgba(255,255,255,0.12)";
  const rankColor = rank <= 3 ? "#0c1432" : "#ffffff";

  const rankBoxSize = isStory ? 72 : 60;
  const rankFontSize = isStory ? 34 : 28;
  const nameFontSize = isStory ? 38 : 32;
  const teamFontSize = isStory ? 22 : 19;
  const goalsFontSize = isStory ? 58 : 48;

  // Width for name area: total - sidePadding*2 - card padding*2 - rank chip - goals area - gaps
  const nameAvailable = 1080 - (isStory ? 160 : 140) - (isStory ? 56 : 48) - rankBoxSize - 140 - 56;
  const fittedNameFs = fitFontSize(scorer.player_name, nameAvailable, nameFontSize, 22);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: isStory ? 24 : 18,
        background: top3 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
        border: top3 ? "2px solid rgba(250,204,21,0.6)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20,
        padding: isStory ? "16px 24px" : "12px 20px",
      }}
    >
      <div
        style={{
          background: rankBg,
          color: rankColor,
          width: rankBoxSize,
          height: rankBoxSize,
          borderRadius: 14,
          flexShrink: 0,
          textAlign: "center",
          lineHeight: `${rankBoxSize}px`,
          fontWeight: 900,
          fontSize: rankFontSize,
        }}
      >
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: fittedNameFs,
            fontWeight: 800,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {scorer.player_name}
        </div>
        <div
          style={{
            fontSize: teamFontSize,
            opacity: 0.65,
            marginTop: 6,
            lineHeight: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {scorer.team_name ?? "—"}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: goalsFontSize, fontWeight: 900, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {scorer.goals}
        </div>
        <div
          style={{
            fontSize: isStory ? 16 : 14,
            opacity: 0.6,
            marginTop: 6,
            letterSpacing: 2,
            textTransform: "uppercase",
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
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
