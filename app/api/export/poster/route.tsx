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
  kickoff_at?: string | null;
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

type DrawGroupBlock = {
  group_id: string;
  group_name: string;
  teams: Team[];
};

type BracketMatchEntry = {
  id: string;
  bracket_position: string;
  round_name: string;
  round_index: number;
  home_team: Team | null;
  away_team: Team | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  winner_team_id: string | null;
};

type BracketPayload = {
  rounds: Array<{ name: string; round_index: number }>;
  matches: BracketMatchEntry[];
  include_third_place: boolean;
  /** "full" → mirror bracket in one image.  "left"/"right" → only that half
   *  plus the final and (optionally) 3rd-place match, for splitting a
   *  16-team bracket across two posters. */
  layout?: "full" | "left" | "right";
};

type PosterRequest = {
  kind: "results" | "standings" | "scorers" | "draw" | "bracket";
  format: "story" | "post";
  title?: string;
  subtitle?: string;
  matches?: MatchEntry[];
  standings?: GroupBlock[];
  scorers?: ScorerEntry[];
  draw?: DrawGroupBlock[];
  bracket?: BracketPayload;
};

const C = {
  // Dark theme: near-black poster with gold accent
  bg: "#0a0a0a",
  bgEnd: "#1a1a1a",
  text: "#f4f4f5",
  textDim: "rgba(244,244,245,0.7)",
  textFaint: "rgba(244,244,245,0.45)",
  // Translucent dark card so the gold watermark glows through.
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(212,175,55,0.25)",
  rowDivider: "rgba(244,244,245,0.10)",
  accent: "#d4af37",
  accentSoft: "rgba(212,175,55,0.15)",
  gold: "#d4af37",
  silver: "#c0c0c0",
  bronze: "#cd7f32",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PosterRequest;
    const { kind, format } = body;
    const width = 1080;
    const height = format === "story" ? 1920 : 1350;
    const logoUrl = `${new URL(request.url).origin}/logo/mkpetrovski-gold.png`;

    let content: React.ReactElement;
    if (kind === "results") {
      content = (
        <ResultsPoster
          title={body.title ?? "PETROVSKI KULA"}
          subtitle={body.subtitle ?? "Grupna faza"}
          matches={body.matches ?? []}
          width={width}
          height={height}
          logoUrl={logoUrl}
        />
      );
    } else if (kind === "standings") {
      content = (
        <StandingsPoster standings={body.standings ?? []} width={width} height={height} logoUrl={logoUrl} />
      );
    } else if (kind === "draw") {
      content = (
        <DrawPoster draw={body.draw ?? []} width={width} height={height} logoUrl={logoUrl} />
      );
    } else if (kind === "bracket") {
      content = (
        <BracketPoster
          payload={body.bracket ?? { rounds: [], matches: [], include_third_place: false }}
          width={width}
          height={height}
          logoUrl={logoUrl}
        />
      );
    } else {
      content = (
        <ScorersPoster scorers={body.scorers ?? []} width={width} height={height} logoUrl={logoUrl} />
      );
    }

    return new ImageResponse(content, { width, height });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/* ============================ FRAME ============================ */

function PosterFrame({
  heading,
  subheading,
  width,
  height,
  logoUrl,
  children,
}: {
  heading: string;
  subheading: string;
  width: number;
  height: number;
  logoUrl?: string;
  children: React.ReactNode;
}) {
  const watermarkSize = Math.min(width, height) * 0.75;
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bgEnd} 100%)`,
        color: C.text,
        padding: "80px 60px",
        position: "relative",
      }}
    >
      {/* Watermark — gold silhouette on dark bg, placed FIRST so subsequent flex
          children render visually on top. */}
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          width={watermarkSize}
          height={watermarkSize}
          alt=""
          style={{
            position: "absolute",
            top: (height - watermarkSize) / 2,
            left: (width - watermarkSize) / 2,
            opacity: 0.18,
            objectFit: "contain",
          }}
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 40 }}>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 12,
            color: C.textDim,
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
            color: C.accent,
          }}
        >
          {heading}
        </div>
        <div
          style={{
            display: "flex",
            width: 100,
            height: 5,
            background: C.accent,
            borderRadius: 3,
            marginTop: 20,
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 30 }}>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: C.accent,
            letterSpacing: 5,
            textTransform: "uppercase",
            fontWeight: 700,
            border: `2px solid ${C.accent}`,
            borderRadius: 999,
            padding: "10px 22px",
          }}
        >
          PETROVSKI · @turnir3x3
        </div>
      </div>
    </div>
  );
}

/* ============================ CREST ============================ */

function Crest({ team, size }: { team: Team | null; size: number }) {
  if (!team) {
    return <div style={{ display: "flex", width: size, height: size }} />;
  }
  const initials = computeInitials(team.name, team.short_name);
  const primary = team.primary_color || "#1f2937";
  const textColor = luminance(primary) > 0.6 ? "#1f2937" : "#ffffff";
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.18),
        background: primary,
        // Subtle outline keeps light-coloured crests legible against the dark poster.
        border: "1px solid rgba(244,244,245,0.25)",
        alignItems: "center",
        justifyContent: "center",
        color: textColor,
        fontSize: Math.round(size * (initials.length >= 3 ? 0.28 : 0.36)),
        fontWeight: 800,
        flexShrink: 0,
        letterSpacing: -0.5,
      }}
    >
      {initials}
    </div>
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

const SR_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAJ", "JUN", "JUL", "AVG", "SEP", "OKT", "NOV", "DEC"];
const SR_WEEKDAYS = ["NED", "PON", "UTO", "SRE", "ČET", "PET", "SUB"];
const EN_WEEKDAY_TO_IDX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function formatKickoffShort(
  iso: string | null | undefined,
): { weekday: string; date: string; time: string } | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Belgrade",
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const enWeekday = get("weekday");
    const monthNum = parseInt(get("month"), 10);
    const day = get("day");
    const hour = get("hour");
    const minute = get("minute");
    if (!day || !hour) return null;
    const weekdayIdx = EN_WEEKDAY_TO_IDX[enWeekday];
    const weekday = weekdayIdx != null ? SR_WEEKDAYS[weekdayIdx] : "";
    const month = SR_MONTHS[(monthNum - 1) % 12] ?? "";
    return { weekday, date: `${day}. ${month}`, time: `${hour}:${minute}` };
  } catch {
    return null;
  }
}

function fitFontSize(name: string, maxWidth: number, base: number, min: number = 22): number {
  if (!name) return base;
  const charW = 0.56;
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
  logoUrl,
}: {
  title: string;
  subtitle: string;
  matches: MatchEntry[];
  width: number;
  height: number;
  logoUrl?: string;
}) {
  return (
    <PosterFrame heading={title.toUpperCase()} subheading={subtitle} width={width} height={height} logoUrl={logoUrl}>
      {matches.length === 0 ? (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 32 }}>
          Nema izabranih mečeva.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          {matches.map((m) => (
            <ResultRow key={m.id} match={m} />
          ))}
        </div>
      )}
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

  const sideAvailable = 280;
  const homeName = match.home_team?.name ?? "?";
  const awayName = match.away_team?.name ?? "?";
  const homeFs = fitFontSize(homeName, sideAvailable, 32);
  const awayFs = fitFontSize(awayName, sideAvailable, 32);
  const kickoff = !isFinished ? formatKickoffShort(match.kickoff_at) : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 20,
        padding: "20px 28px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          opacity: isFinished && !homeWin && match.home_score !== match.away_score ? 0.55 : 1,
        }}
      >
        <Crest team={match.home_team} size={70} />
        <div style={{ display: "flex", marginLeft: 20, fontSize: homeFs, fontWeight: 800 }}>
          {homeName}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 220 }}>
        {isFinished ? (
          <>
            <div style={{ display: "flex", fontSize: 58, fontWeight: 900, letterSpacing: -1 }}>
              {`${match.home_score} : ${match.away_score}`}
            </div>
            {hasPens && (
              <div style={{ display: "flex", fontSize: 20, color: C.textDim, marginTop: 6, fontWeight: 700 }}>
                {`penali ${match.home_pen}-${match.away_pen}`}
              </div>
            )}
          </>
        ) : kickoff ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                width: "100%",
                justifyContent: "center",
                fontSize: 24,
                color: C.text,
                fontWeight: 800,
                letterSpacing: 2,
              }}
            >
              {kickoff.date}
            </div>
            <div
              style={{
                display: "flex",
                width: "100%",
                justifyContent: "center",
                fontSize: 44,
                color: C.text,
                fontWeight: 900,
                letterSpacing: 1,
                marginTop: 6,
              }}
            >
              {kickoff.time}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 50, fontWeight: 900, color: C.textDim }}>vs</div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          justifyContent: "flex-end",
          opacity: isFinished && !awayWin && match.home_score !== match.away_score ? 0.55 : 1,
        }}
      >
        <div style={{ display: "flex", marginRight: 20, fontSize: awayFs, fontWeight: 800 }}>
          {awayName}
        </div>
        <Crest team={match.away_team} size={70} />
      </div>
    </div>
  );
}

/* ============================ STANDINGS ============================ */

function StandingsPoster({
  standings,
  width,
  height,
  logoUrl,
}: {
  standings: GroupBlock[];
  width: number;
  height: number;
  logoUrl?: string;
}) {
  // All groups stack vertically — never side-by-side. Cap is enforced by the
  // client which chunks the selection before posting. Each card renders the
  // same row count (padded if needed) so cards are pixel-identical.
  const maxRows = standings.reduce((acc, g) => Math.max(acc, g.rows.length), 0);
  // Switch to compact sizing whenever there are 2+ cards so they fit on the
  // shorter Objava (1080×1350) format too.
  const compact = standings.length >= 2;
  return (
    <PosterFrame heading="TABELE" subheading="Grupna faza" width={width} height={height} logoUrl={logoUrl}>
      {standings.length === 0 ? (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 32 }}>
          Nema podataka.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 16 : 24 }}>
          {standings.map((g) => (
            <GroupTable key={g.group_id} group={g} compact={compact} rowsToShow={maxRows} />
          ))}
        </div>
      )}
    </PosterFrame>
  );
}

function GroupTable({ group, compact, rowsToShow }: { group: GroupBlock; compact: boolean; rowsToShow: number }) {
  const titleSize = compact ? 30 : 44;
  const rowFs = compact ? 24 : 32;
  const headerFs = compact ? 16 : 20;
  const crestSize = compact ? 36 : 48;
  const rowH = compact ? 56 : 70;
  const padding = compact ? 22 : 32;
  // Explicit total height = padding*2 + title + title-margin + header + headerPad +
  // rowsToShow * rowH. Keeps every card pixel-identical even when row counts differ.
  const totalHeight =
    padding * 2 +
    titleSize +
    16 /* title marginBottom */ +
    headerFs * 1.4 /* header line height */ +
    12 /* header paddingBottom + border */ +
    rowsToShow * rowH;

  // Pad with placeholder rows so every card always renders the same number.
  const padded: Array<GroupBlock["rows"][number] | null> = [...group.rows];
  while (padded.length < rowsToShow) padded.push(null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: totalHeight,
        background: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 20,
        padding,
      }}
    >
      <div style={{ display: "flex", fontSize: titleSize, fontWeight: 900, letterSpacing: -1, marginBottom: 16 }}>
        {group.group_name}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          color: C.textDim,
          fontSize: headerFs,
          textTransform: "uppercase",
          letterSpacing: 2,
          paddingBottom: 8,
          borderBottom: `1px solid ${C.rowDivider}`,
        }}
      >
        <div style={{ display: "flex", width: 40 }}>#</div>
        <div style={{ display: "flex", flex: 1 }}>Tim</div>
        <div style={{ display: "flex", width: 60, justifyContent: "flex-end" }}>O</div>
        <div style={{ display: "flex", width: 80, justifyContent: "flex-end" }}>GR</div>
        <div style={{ display: "flex", width: 90, justifyContent: "flex-end" }}>Bod</div>
      </div>
      {padded.map((r, i) => {
        const top2 = i < 2;
        const isLast = i === padded.length - 1;
        if (!r) {
          // Placeholder row — same height as real ones, no content, faint divider.
          return (
            <div
              key={`__pad-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                height: rowH,
                borderBottom: isLast ? "none" : `1px solid ${C.rowDivider}`,
                opacity: 0,
              }}
            >
              <div style={{ display: "flex" }}>·</div>
            </div>
          );
        }
        return (
          <div
            key={r.team_id}
            style={{
              display: "flex",
              alignItems: "center",
              height: rowH,
              borderBottom: isLast ? "none" : `1px solid ${C.rowDivider}`,
            }}
          >
            <div style={{ display: "flex", width: 40, fontSize: rowFs, fontWeight: 800, opacity: top2 ? 1 : 0.55 }}>
              {String(i + 1)}
            </div>
            <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
              <Crest
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
            <div style={{ display: "flex", width: 60, justifyContent: "flex-end", fontSize: rowFs, color: C.textDim }}>
              {String(r.played)}
            </div>
            <div style={{ display: "flex", width: 80, justifyContent: "flex-end", fontSize: rowFs, color: C.textDim }}>
              {r.goal_diff > 0 ? `+${r.goal_diff}` : String(r.goal_diff)}
            </div>
            <div style={{ display: "flex", width: 90, justifyContent: "flex-end", fontSize: rowFs + 2, fontWeight: 900 }}>
              {String(r.points)}
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
  logoUrl,
}: {
  scorers: ScorerEntry[];
  width: number;
  height: number;
  logoUrl?: string;
}) {
  const isStory = height >= 1900;
  const max = isStory ? 10 : 8;
  return (
    <PosterFrame heading="STRELCI" subheading="Najbolji" width={width} height={height} logoUrl={logoUrl}>
      {scorers.length === 0 ? (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 32 }}>
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
  const rankBg =
    rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : "rgba(244,244,245,0.10)";
  const rankFg = rank <= 3 ? "#0a0a0a" : "#f4f4f5";

  const fittedFs = fitFontSize(scorer.player_name, 600, 34, 22);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: top3 ? C.accentSoft : C.cardBg,
        border: top3 ? `2px solid ${C.accent}` : `1px solid ${C.cardBorder}`,
        borderRadius: 18,
        padding: "14px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 60,
          height: 60,
          borderRadius: 14,
          background: rankBg,
          color: rankFg,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {String(rank)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 20 }}>
        <div style={{ display: "flex", fontSize: fittedFs, fontWeight: 800 }}>
          {scorer.player_name}
        </div>
        <div style={{ display: "flex", fontSize: 20, color: C.textDim, marginTop: 2 }}>
          {scorer.team_name ?? "—"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{ display: "flex", fontSize: 52, fontWeight: 900 }}>{String(scorer.goals)}</div>
        <div
          style={{
            display: "flex",
            fontSize: 14,
            color: C.textDim,
            letterSpacing: 2,
            textTransform: "uppercase",
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          golova
        </div>
      </div>
    </div>
  );
}

/* ============================ DRAW ============================ */

function DrawPoster({
  draw,
  width,
  height,
  logoUrl,
}: {
  draw: DrawGroupBlock[];
  width: number;
  height: number;
  logoUrl?: string;
}) {
  if (draw.length === 0) {
    return (
      <PosterFrame heading="ŽREB" subheading="Grupna faza" width={width} height={height} logoUrl={logoUrl}>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 32 }}>
          Nema podataka o žrebu.
        </div>
      </PosterFrame>
    );
  }
  // Split groups into two columns when 4+; otherwise stack in a single column.
  // Using explicit left/right columns avoids Satori's spotty support for
  // flex-wrap + calc() widths which produced corrupt PNGs.
  const useTwoColumns = draw.length >= 4;
  const compact = draw.length >= 5;
  const gap = compact ? 14 : 22;

  if (!useTwoColumns) {
    return (
      <PosterFrame heading="ŽREB" subheading="Grupna faza" width={width} height={height} logoUrl={logoUrl}>
        <div style={{ display: "flex", flexDirection: "column", gap, flexGrow: 1 }}>
          {draw.map((g) => (
            <DrawGroupCard key={g.group_id} group={g} compact={compact} />
          ))}
        </div>
      </PosterFrame>
    );
  }

  // 2-column layout: alternate groups into left/right buckets so the columns
  // stay balanced even when group sizes differ a bit.
  const left: DrawGroupBlock[] = [];
  const right: DrawGroupBlock[] = [];
  draw.forEach((g, i) => (i % 2 === 0 ? left : right).push(g));

  return (
    <PosterFrame heading="ŽREB" subheading="Grupna faza" width={width} height={height} logoUrl={logoUrl}>
      <div style={{ display: "flex", gap, flexGrow: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap, flexGrow: 1, flexBasis: 0 }}>
          {left.map((g) => (
            <DrawGroupCard key={g.group_id} group={g} compact={compact} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap, flexGrow: 1, flexBasis: 0 }}>
          {right.map((g) => (
            <DrawGroupCard key={g.group_id} group={g} compact={compact} />
          ))}
        </div>
      </div>
    </PosterFrame>
  );
}

function DrawGroupCard({
  group,
  compact,
}: {
  group: DrawGroupBlock;
  compact: boolean;
}) {
  const titleSize = compact ? 30 : 38;
  const rowFs = compact ? 24 : 30;
  const crestSize = compact ? 36 : 44;
  const rowH = compact ? 56 : 66;
  const padding = compact ? 22 : 28;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 20,
        padding,
      }}
    >
      <div style={{ display: "flex", fontSize: titleSize, fontWeight: 900, letterSpacing: -1, color: C.accent, marginBottom: 14 }}>
        {group.group_name.toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {group.teams.map((t, i) => {
          const isLast = i === group.teams.length - 1;
          return (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                height: rowH,
                borderBottom: isLast ? "none" : `1px solid ${C.rowDivider}`,
              }}
            >
              <Crest team={t} size={crestSize} />
              <div
                style={{
                  display: "flex",
                  marginLeft: 16,
                  fontSize: rowFs,
                  fontWeight: 700,
                  flexGrow: 1,
                }}
              >
                {t.name}
              </div>
            </div>
          );
        })}
        {group.teams.length === 0 && (
          <div style={{ display: "flex", color: C.textFaint, fontStyle: "italic", fontSize: rowFs, padding: "10px 0" }}>
            Bez timova
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ BRACKET ============================ */

function BracketPoster({
  payload,
  width,
  height,
  logoUrl,
}: {
  payload: BracketPayload;
  width: number;
  height: number;
  logoUrl?: string;
}) {
  const { rounds, matches, include_third_place, layout = "full" } = payload;
  if (rounds.length === 0 || matches.length === 0) {
    return (
      <PosterFrame heading="ELIMINACIJE" subheading="Nokaut faza" width={width} height={height} logoUrl={logoUrl}>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 32 }}>
          Eliminacioni kostur još nije postavljen.
        </div>
      </PosterFrame>
    );
  }

  const byRound = new Map<number, BracketMatchEntry[]>();
  const thirdPlace: BracketMatchEntry[] = [];
  for (const m of matches) {
    if (m.bracket_position === "TP") {
      thirdPlace.push(m);
      continue;
    }
    const arr = byRound.get(m.round_index) ?? [];
    arr.push(m);
    byRound.set(m.round_index, arr);
  }
  for (const list of byRound.values()) {
    list.sort((a, b) => {
      const am = a.bracket_position.match(/_(\d+)$/);
      const bm = b.bracket_position.match(/_(\d+)$/);
      if (am && bm) return parseInt(am[1], 10) - parseInt(bm[1], 10);
      return a.bracket_position.localeCompare(b.bracket_position);
    });
  }

  const sortedRounds = [...rounds].sort((a, b) => a.round_index - b.round_index);
  const finalRoundIdx = sortedRounds[sortedRounds.length - 1]?.round_index ?? 0;
  const finalRoundName = sortedRounds[sortedRounds.length - 1]?.name ?? "Finale";
  const nonFinal = sortedRounds.slice(0, -1);
  const finalMatches = byRound.get(finalRoundIdx) ?? [];

  const sides = nonFinal.map((r) => {
    const list = byRound.get(r.round_index) ?? [];
    const half = Math.ceil(list.length / 2);
    return { round: r, left: list.slice(0, half), right: list.slice(half) };
  });

  type Col = {
    key: string;
    title: string;
    matches: BracketMatchEntry[];
    side: "left" | "right" | "center";
    isOutermost: boolean;
  };

  let columns: Col[];
  if (layout === "left") {
    columns = [
      ...sides.map<Col>((s, i) => ({
        key: `L-${s.round.round_index}`,
        title: s.round.name,
        matches: s.left,
        side: "left",
        isOutermost: i === 0,
      })),
      { key: "F", title: finalRoundName, matches: finalMatches, side: "center", isOutermost: false },
    ];
  } else if (layout === "right") {
    columns = [
      { key: "F", title: finalRoundName, matches: finalMatches, side: "center", isOutermost: false },
      ...sides
        .slice()
        .reverse()
        .map<Col>((s, i) => ({
          key: `R-${s.round.round_index}`,
          title: s.round.name,
          matches: s.right,
          side: "right",
          isOutermost: i === sides.length - 1,
        })),
    ];
  } else {
    columns = [
      ...sides.map<Col>((s, i) => ({
        key: `L-${s.round.round_index}`,
        title: s.round.name,
        matches: s.left,
        side: "left",
        isOutermost: i === 0,
      })),
      { key: "F", title: finalRoundName, matches: finalMatches, side: "center", isOutermost: false },
      ...sides
        .slice()
        .reverse()
        .map<Col>((s, i) => ({
          key: `R-${s.round.round_index}`,
          title: s.round.name,
          matches: s.right,
          side: "right",
          isOutermost: i === sides.length - 1,
        })),
    ];
  }

  const totalColumns = columns.length;
  const horizontalBudget = width - 120;
  const colGap = 14;
  const colWidth = Math.floor((horizontalBudget - colGap * (totalColumns - 1)) / totalColumns);

  // Explicit bracket grid height. The reserves below account for the heading
  // block at the top, the gold footer pill + its margin at the bottom, and
  // the 3rd-place card stack that hangs below the F column — so the F
  // column's natural height (header + matches + 3rd-place) doesn't push
  // into the pill area on Story format.
  const headingArea = 260;
  const footerArea = 140;
  const thirdPlaceArea = include_third_place && thirdPlace.length > 0 ? 240 : 0;
  const bracketHeight = Math.max(360, height - 80 * 2 - headingArea - footerArea - thirdPlaceArea);

  // Slot height per column = bracketHeight divided by match count. Using
  // justify-content: space-around puts every match's vertical center at
  // (i + 0.5) * slotHeight, so the distance between adjacent centers in the
  // same column equals slotHeight — exactly what the vertical connector
  // needs to span.
  const COLUMN_HEADER_HEIGHT = 36;
  const innerHeight = Math.max(120, bracketHeight - COLUMN_HEADER_HEIGHT);

  return (
    <PosterFrame heading="ELIMINACIJE" subheading="Nokaut faza" width={width} height={height} logoUrl={logoUrl}>
      <div
        style={{
          display: "flex",
          gap: colGap,
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        {columns.map((c) => {
          const n = Math.max(1, c.matches.length);
          const slotHeight = Math.floor(innerHeight / n);
          // In split mode the center "F" column only shows this half's
          // finalist (home for left, away for right) — no opponent rectangle.
          const singleFinalSlot: "home" | "away" | null =
            c.side === "center" && layout === "left"
              ? "home"
              : c.side === "center" && layout === "right"
              ? "away"
              : null;
          // Attach the 3rd-place match to the center column so it renders
          // directly underneath the F card at the same width.
          const thirdPlaceForCol =
            c.side === "center" && include_third_place && thirdPlace.length > 0 ? thirdPlace[0] : null;
          return (
            <BracketPosterColumn
              key={c.key}
              title={c.title}
              matches={c.matches}
              colWidth={colWidth}
              slotHeight={slotHeight}
              bracketHeight={bracketHeight}
              side={c.side}
              isOutermost={c.isOutermost}
              singleFinalSlot={singleFinalSlot}
              thirdPlaceMatch={thirdPlaceForCol}
            />
          );
        })}
      </div>
    </PosterFrame>
  );
}

function BracketPosterColumn({
  title,
  matches,
  colWidth,
  slotHeight,
  bracketHeight,
  side,
  isOutermost,
  singleFinalSlot,
  thirdPlaceMatch,
}: {
  title: string;
  matches: BracketMatchEntry[];
  colWidth: number;
  slotHeight: number;
  bracketHeight: number;
  side: "left" | "right" | "center";
  isOutermost: boolean;
  /** Center column in split-mode renders only this side's finalist. */
  singleFinalSlot?: "home" | "away" | null;
  /** Render the 3rd-place match directly below this column's matches grid. */
  thirdPlaceMatch?: BracketMatchEntry | null;
}) {
  const outgoingRight = side === "left";
  const isCenter = side === "center";
  const outgoingSide = outgoingRight ? "right" : "left";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: colWidth,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 16,
          color: C.accent,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          justifyContent: "center",
          marginBottom: 10,
          height: 26,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-around",
          height: bracketHeight,
        }}
      >
        {matches.map((m, i) => {
          const isPairTop = i % 2 === 0;
          const hasPairBelow = i + 1 < matches.length;
          // One vertical connector per pair, drawn from the TOP match's
          // center down to its partner's center. Skip on center column.
          const showVertical = !isCenter && isPairTop && hasPairBelow;
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                position: "relative",
                flexDirection: "column",
              }}
            >
              {/* Incoming horizontal stub (from previous round on the outer side) */}
              {!isOutermost && !isCenter && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    [outgoingSide === "right" ? "left" : "right"]: -7,
                    width: 7,
                    height: 1,
                    background: C.cardBorder,
                  }}
                />
              )}
              {/* Outgoing horizontal stub (toward the next inner round / center) */}
              {!isCenter && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    [outgoingSide]: -7,
                    width: 7,
                    height: 1,
                    background: C.cardBorder,
                  }}
                />
              )}
              {/* Center column stubs on both sides */}
              {isCenter && (
                <>
                  <div style={{ position: "absolute", top: "50%", left: -7, width: 7, height: 1, background: C.cardBorder }} />
                  <div style={{ position: "absolute", top: "50%", right: -7, width: 7, height: 1, background: C.cardBorder }} />
                </>
              )}
              {/* Vertical connector — height equals slot distance so the line
                  reaches exactly to the next match's center. */}
              {showVertical && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    [outgoingSide]: -7,
                    width: 1,
                    height: slotHeight,
                    background: C.cardBorder,
                  }}
                />
              )}
              <BracketPosterMatch
                match={m}
                colWidth={colWidth}
                only={side === "center" ? singleFinalSlot ?? null : null}
              />
            </div>
          );
        })}
      </div>
      {thirdPlaceMatch && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 16,
            paddingTop: 14,
            borderTop: `1px dashed ${C.cardBorder}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 14,
              color: C.textDim,
              textTransform: "uppercase",
              letterSpacing: 3,
              justifyContent: "center",
              marginBottom: 8,
            }}
          >
            3. mesto
          </div>
          <BracketPosterMatch match={thirdPlaceMatch} colWidth={colWidth} />
        </div>
      )}
    </div>
  );
}

function BracketPosterMatch({
  match: m,
  colWidth,
  only,
}: {
  match: BracketMatchEntry;
  colWidth: number;
  /** When set, render only one slot. Used for split-mode final card so we
   *  don't draw an empty rectangle for the other side's finalist. */
  only?: "home" | "away" | null;
}) {
  const isFinished = m.status === "finished" || m.status === "live";
  const winnerId = m.winner_team_id;
  const homeWin = winnerId && m.home_team && m.home_team.id === winnerId;
  const awayWin = winnerId && m.away_team && m.away_team.id === winnerId;
  const homeText = m.home_team?.name ?? m.home_placeholder ?? "—";
  const awayText = m.away_team?.name ?? m.away_placeholder ?? "—";

  // Font + padding scale with the column width so a split-mode poster
  // (wider columns) renders names large enough to read at a glance.
  const nameFs = colWidth >= 220 ? 28 : colWidth >= 180 ? 24 : colWidth >= 150 ? 20 : 16;
  const scoreFs = colWidth >= 220 ? 22 : colWidth >= 180 ? 19 : colWidth >= 150 ? 17 : 14;
  const padV = colWidth >= 180 ? 12 : 8;
  const padH = colWidth >= 180 ? 16 : 10;

  const showHome = only !== "away";
  const showAway = only !== "home";
  const showScore = !only;

  // Available horizontal space for team-name text inside the card row.
  const textWidth = colWidth - padH * 2 - 4;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 10,
        padding: `${padV}px ${padH}px`,
        width: "100%",
      }}
    >
      {showHome && (
        <SlotRow
          text={homeText}
          highlighted={!!homeWin}
          placeholder={!m.home_team}
          fontSize={nameFs}
          textWidth={textWidth}
        />
      )}
      {showScore && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            fontSize: scoreFs,
            color: C.textDim,
            fontWeight: 700,
            padding: "4px 0",
          }}
        >
          {isFinished ? `${m.home_score ?? 0} : ${m.away_score ?? 0}` : "vs"}
        </div>
      )}
      {showAway && (
        <SlotRow
          text={awayText}
          highlighted={!!awayWin}
          placeholder={!m.away_team}
          fontSize={nameFs}
          textWidth={textWidth}
        />
      )}
    </div>
  );
}

/** Pick the largest font size from [minFs, baseFs] at which the text fits a
 *  single line within textWidth. Empirical char-width = 0.55 × fontSize. */
function fitFontSizeForText(text: string, baseFs: number, textWidth: number, minFs = 12): number {
  if (!text) return baseFs;
  const charWidth = 0.55;
  if (text.length * baseFs * charWidth <= textWidth) return baseFs;
  const target = Math.floor(textWidth / (text.length * charWidth));
  return Math.max(minFs, Math.min(baseFs, target));
}

function SlotRow({
  text,
  highlighted,
  placeholder,
  fontSize = 14,
  textWidth,
}: {
  text: string;
  highlighted: boolean;
  placeholder: boolean;
  fontSize?: number;
  textWidth?: number;
}) {
  const fittedFs = textWidth ? fitFontSizeForText(text, fontSize, textWidth) : fontSize;
  return (
    <div
      style={{
        display: "flex",
        fontSize: fittedFs,
        fontWeight: highlighted ? 900 : 600,
        color: highlighted ? C.accent : placeholder ? C.textFaint : C.text,
        padding: "4px 2px",
        fontStyle: placeholder ? "italic" : "normal",
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      {text}
    </div>
  );
}
