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

type PosterRequest = {
  kind: "results" | "standings" | "scorers";
  format: "story" | "post";
  title?: string;
  subtitle?: string;
  matches?: MatchEntry[];
  standings?: GroupBlock[];
  scorers?: ScorerEntry[];
};

const C = {
  bg: "#0a1740",
  bgEnd: "#1e3a8a",
  text: "#ffffff",
  textDim: "rgba(255,255,255,0.7)",
  textFaint: "rgba(255,255,255,0.5)",
  cardBg: "rgba(255,255,255,0.08)",
  cardBorder: "rgba(255,255,255,0.14)",
  rowDivider: "rgba(255,255,255,0.08)",
  accent: "#60a5fa",
  gold: "#facc15",
  silver: "#cbd5e1",
  bronze: "#f59e0b",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PosterRequest;
    const { kind, format } = body;
    const width = 1080;
    const height = format === "story" ? 1920 : 1350;
    const logoUrl = `${new URL(request.url).origin}/logo/liga_sampiona.png`;

    let content: React.ReactElement;
    if (kind === "results") {
      content = (
        <ResultsPoster
          title={body.title ?? "TURNIR KULA"}
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
      {/* Watermark — placed FIRST so subsequent flex children render visually on top.
          Low opacity, centered, scaled to ~75% of the smaller dimension. */}
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
            opacity: 0.08,
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

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          fontSize: 22,
          color: C.textDim,
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
    rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : "rgba(255,255,255,0.12)";
  const rankFg = rank <= 3 ? "#0c1432" : "#ffffff";

  const fittedFs = fitFontSize(scorer.player_name, 600, 34, 22);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: top3 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
        border: top3 ? "2px solid rgba(250,204,21,0.6)" : `1px solid ${C.cardBorder}`,
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
