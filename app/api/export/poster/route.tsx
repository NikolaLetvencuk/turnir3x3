import { ImageResponse } from "next/og";

export const runtime = "edge";

type Team = {
  id: string;
  name: string;
  short_name?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};

type MatchEntry = {
  id: string;
  status: string;
  home_score: number;
  away_score: number;
  home_pen?: number | null;
  away_pen?: number | null;
  home_team: Team | null;
  away_team: Team | null;
};

type StandingRow = {
  team_id: string;
  team_name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  played: number;
  goal_diff: number;
  points: number;
};

type GroupBlock = {
  group_id: string;
  group_name: string;
  rows: StandingRow[];
};

type ScorerEntry = {
  player_id: string;
  player_name: string;
  team_name: string | null;
  goals: number;
};

type PosterRequest = {
  kind: "results" | "standings" | "scorers";
  format: "story" | "post";
  title?: string;
  subtitle?: string;
  matches?: MatchEntry[];
  standings?: GroupBlock[];
  scorers?: ScorerEntry[];
};

const COLORS = {
  bg: "#0a1740",
  bgEnd: "#1e3a8a",
  text: "#ffffff",
  textDim: "rgba(255,255,255,0.65)",
  cardBg: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.14)",
  accent: "#60a5fa",
  gold: "#facc15",
  silver: "#cbd5e1",
  bronze: "#f59e0b",
};

export async function POST(request: Request) {
  const body = (await request.json()) as PosterRequest;
  const { kind, format } = body;
  const width = 1080;
  const height = format === "story" ? 1920 : 1350;

  let content: React.ReactElement;
  if (kind === "results") {
    content = (
      <ResultsPoster
        title={body.title ?? "TURNIR KULA"}
        subtitle={body.subtitle ?? "Grupna faza"}
        matches={body.matches ?? []}
        width={width}
        height={height}
      />
    );
  } else if (kind === "standings") {
    content = (
      <StandingsPoster
        standings={body.standings ?? []}
        width={width}
        height={height}
      />
    );
  } else {
    content = (
      <ScorersPoster
        scorers={body.scorers ?? []}
        width={width}
        height={height}
      />
    );
  }

  return new ImageResponse(content, { width, height });
}

/* ============================ FRAME ============================ */

function PosterFrame({
  heading,
  subheading,
  width,
  height,
  children,
}: {
  heading: string;
  subheading: string;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg, ${COLORS.bg} 0%, ${COLORS.bgEnd} 100%)`,
        color: COLORS.text,
        padding: "80px 60px",
        fontFamily: "Inter",
      }}
    >
      {/* Brand header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 12,
            color: COLORS.textDim,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {subheading}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 100,
            fontWeight: 900,
            marginTop: 12,
            letterSpacing: -2,
          }}
        >
          {heading}
        </div>
        <div
          style={{
            display: "flex",
            width: 100,
            height: 5,
            background: COLORS.accent,
            borderRadius: 3,
            marginTop: 20,
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        {children}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          fontSize: 22,
          color: COLORS.textDim,
          letterSpacing: 5,
          textTransform: "uppercase",
          fontWeight: 600,
          marginTop: 30,
        }}
      >
        TURNIR KULA · @turnir3x3
      </div>
    </div>
  );
}

/* ============================ CREST ============================ */

function CrestSatori({ team, size }: { team: Team | null; size: number }) {
  if (!team) return <div style={{ display: "flex", width: size, height: size }} />;
  const initials = computeInitials(team.name, team.short_name);
  const primary = team.primary_color || "#1f2937";
  const stroke = luminance(primary) > 0.85 ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)";
  const textColor = luminance(primary) > 0.6 ? "#1f2937" : "#ffffff";
  // Use inline SVG: Satori renders SVG with deterministic baseline.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ display: "block" }}
    >
      <path
        d="M8 6 H56 V36 Q56 50 32 60 Q8 50 8 36 Z"
        fill={primary}
        stroke={stroke}
        strokeWidth="1.5"
      />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={initials.length >= 3 ? 17 : 22}
        fontWeight="700"
        fill={textColor}
        fontFamily="Inter"
      >
        {initials}
      </text>
    </svg>
  );
}

function computeInitials(name: string, shortName?: string | null): string {
  if (shortName && shortName.trim()) return shortName.trim().slice(0, 3).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function fitFontSize(name: string, maxWidth: number, base: number, min: number = 22): number {
  if (!name) return base;
  const charW = 0.55;
  const fitted = Math.floor(maxWidth / (name.length * charW));
  return Math.max(min, Math.min(base, fitted));
}

/* ============================ RESULTS ============================ */

function ResultsPoster({
  title,
  subtitle,
  matches,
  width,
  height,
}: {
  title: string;
  subtitle: string;
  matches: MatchEntry[];
  width: number;
  height: number;
}) {
  return (
    <PosterFrame heading={title.toUpperCase()} subheading={subtitle} width={width} height={height}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        {matches.length === 0 ? (
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: COLORS.textDim, fontSize: 32 }}>
            Nema izabranih mečeva.
          </div>
        ) : (
          matches.map((m) => <ResultRow key={m.id} match={m} />)
        )}
      </div>
    </PosterFrame>
  );
}

function ResultRow({ match }: { match: MatchEntry }) {
  const isFinished = match.status === "finished" || match.status === "live";
  const hasPens = match.home_pen != null && match.away_pen != null;
  const homeWin =
    isFinished &&
    (match.home_score > match.away_score ||
      (hasPens && (match.home_pen ?? 0) > (match.away_pen ?? 0)));
  const awayWin =
    isFinished &&
    (match.away_score > match.home_score ||
      (hasPens && (match.away_pen ?? 0) > (match.home_pen ?? 0)));

  // Each side has ~310px after the score area + paddings + crest + gap.
  // Auto-shrink to keep on one line.
  const sideAvailable = 290;
  const homeName = match.home_team?.name ?? "?";
  const awayName = match.away_team?.name ?? "?";
  const baseFs = 32;
  const homeFs = fitFontSize(homeName, sideAvailable, baseFs);
  const awayFs = fitFontSize(awayName, sideAvailable, baseFs);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: COLORS.cardBg,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 20,
        padding: "20px 28px",
      }}
    >
      {/* Home */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          opacity: isFinished && !homeWin && match.home_score !== match.away_score ? 0.55 : 1,
        }}
      >
        <CrestSatori team={match.home_team} size={70} />
        <div
          style={{
            display: "flex",
            marginLeft: 20,
            fontSize: homeFs,
            fontWeight: 800,
            overflow: "hidden",
          }}
        >
          {homeName}
        </div>
      </div>
      {/* Score */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 200,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 58,
            fontWeight: 900,
            letterSpacing: -1,
          }}
        >
          {isFinished ? `${match.home_score} : ${match.away_score}` : "vs"}
        </div>
        {hasPens && (
          <div
            style={{
              display: "flex",
              fontSize: 20,
              opacity: 0.85,
              marginTop: 6,
              fontWeight: 700,
            }}
          >
            penali {match.home_pen}-{match.away_pen}
          </div>
        )}
      </div>
      {/* Away */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          justifyContent: "flex-end",
          opacity: isFinished && !awayWin && match.home_score !== match.away_score ? 0.55 : 1,
        }}
      >
        <div
          style={{
            display: "flex",
            marginRight: 20,
            fontSize: awayFs,
            fontWeight: 800,
            overflow: "hidden",
          }}
        >
          {awayName}
        </div>
        <CrestSatori team={match.away_team} size={70} />
      </div>
    </div>
  );
}

/* ============================ STANDINGS ============================ */

function StandingsPoster({
  standings,
  width,
  height,
}: {
  standings: GroupBlock[];
  width: number;
  height: number;
}) {
  const useTwoCols = standings.length >= 3;
  return (
    <PosterFrame heading="TABELE" subheading="Grupna faza" width={width} height={height}>
      {standings.length === 0 ? (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: COLORS.textDim, fontSize: 32 }}>
          Nema podataka.
        </div>
      ) : useTwoCols ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {chunkEvery(standings, 2).map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 20 }}>
              {row.map((g) => (
                <div key={g.group_id} style={{ display: "flex", flex: 1 }}>
                  <GroupTable group={g} compact />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {standings.map((g) => (
            <GroupTable key={g.group_id} group={g} compact={false} />
          ))}
        </div>
      )}
    </PosterFrame>
  );
}

function chunkEvery<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function GroupTable({ group, compact }: { group: GroupBlock; compact: boolean }) {
  const titleSize = compact ? 30 : 44;
  const rowFs = compact ? 24 : 32;
  const headerFs = compact ? 16 : 20;
  const crestSize = compact ? 36 : 48;
  const rowH = compact ? 50 : 64;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: COLORS.cardBg,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 20,
        padding: compact ? 22 : 32,
      }}
    >
      <div style={{ display: "flex", fontSize: titleSize, fontWeight: 900, letterSpacing: -1, marginBottom: 16 }}>
        {group.group_name}
      </div>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          color: COLORS.textDim,
          fontSize: headerFs,
          textTransform: "uppercase",
          letterSpacing: 2,
          paddingBottom: 8,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ display: "flex", width: 40 }}>#</div>
        <div style={{ display: "flex", flex: 1 }}>Tim</div>
        <div style={{ display: "flex", width: 60, justifyContent: "flex-end" }}>O</div>
        <div style={{ display: "flex", width: 80, justifyContent: "flex-end" }}>GR</div>
        <div style={{ display: "flex", width: 90, justifyContent: "flex-end" }}>Bod</div>
      </div>
      {/* Data rows */}
      {group.rows.map((r, i) => {
        const top2 = i < 2;
        return (
          <div
            key={r.team_id}
            style={{
              display: "flex",
              alignItems: "center",
              height: rowH,
              borderBottom: i === group.rows.length - 1 ? "none" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", width: 40, fontSize: rowFs, fontWeight: 800, opacity: top2 ? 1 : 0.55 }}>
              {i + 1}
            </div>
            <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
              <CrestSatori
                team={{
                  id: r.team_id,
                  name: r.team_name,
                  short_name: r.short_name,
                  primary_color: r.primary_color,
                  secondary_color: r.secondary_color,
                }}
                size={crestSize}
              />
              <div style={{ display: "flex", marginLeft: 14, fontSize: rowFs, fontWeight: 700 }}>
                {r.team_name}
              </div>
            </div>
            <div style={{ display: "flex", width: 60, justifyContent: "flex-end", fontSize: rowFs, opacity: 0.75 }}>
              {r.played}
            </div>
            <div style={{ display: "flex", width: 80, justifyContent: "flex-end", fontSize: rowFs, opacity: 0.75 }}>
              {r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}
            </div>
            <div style={{ display: "flex", width: 90, justifyContent: "flex-end", fontSize: rowFs + 2, fontWeight: 900 }}>
              {r.points}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================ SCORERS ============================ */

function ScorersPoster({
  scorers,
  width,
  height,
}: {
  scorers: ScorerEntry[];
  width: number;
  height: number;
}) {
  const isStory = height >= 1900;
  const max = isStory ? 10 : 8;
  return (
    <PosterFrame heading="STRELCI" subheading="Najbolji" width={width} height={height}>
      {scorers.length === 0 ? (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: COLORS.textDim, fontSize: 32 }}>
          Još nema strelaca.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {scorers.slice(0, max).map((s, i) => (
            <ScorerRow key={s.player_id} scorer={s} rank={i + 1} />
          ))}
        </div>
      )}
    </PosterFrame>
  );
}

function ScorerRow({ scorer, rank }: { scorer: ScorerEntry; rank: number }) {
  const top3 = rank <= 3;
  const rankBg = rank === 1 ? COLORS.gold : rank === 2 ? COLORS.silver : rank === 3 ? COLORS.bronze : "rgba(255,255,255,0.12)";
  const rankFg = rank <= 3 ? "#0c1432" : "#ffffff";

  const nameAvailable = 600;
  const fittedFs = fitFontSize(scorer.player_name, nameAvailable, 34, 22);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: top3 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
        border: top3 ? "2px solid rgba(250,204,21,0.6)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: 18,
        padding: "14px 22px",
      }}
    >
      {/* Rank chip — inline SVG; Satori centers via dominantBaseline */}
      <svg width={60} height={60} viewBox="0 0 60 60" style={{ display: "block" }}>
        <rect width="60" height="60" rx="14" fill={rankBg} />
        <text
          x="30"
          y="30"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="28"
          fontWeight="900"
          fill={rankFg}
          fontFamily="Inter"
        >
          {rank}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 20, overflow: "hidden" }}>
        <div style={{ display: "flex", fontSize: fittedFs, fontWeight: 800 }}>
          {scorer.player_name}
        </div>
        <div style={{ display: "flex", fontSize: 20, color: COLORS.textDim, marginTop: 2 }}>
          {scorer.team_name ?? "—"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{ display: "flex", fontSize: 52, fontWeight: 900 }}>
          {scorer.goals}
        </div>
        <div style={{ display: "flex", fontSize: 14, color: COLORS.textDim, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, marginTop: 2 }}>
          golova
        </div>
      </div>
    </div>
  );
}
