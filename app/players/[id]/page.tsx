import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TeamCrest } from "@/components/TeamCrest";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const SR_MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
function formatKickoff(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const m = SR_MONTHS[d.getMonth()] ?? "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${day}. ${m} · ${hh}:${mm}`;
  } catch {
    return "";
  }
}

type Team = {
  id: string;
  name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
};

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [playerRes, eventsRes, matchesRes] = await Promise.all([
    supabase
      .from("players")
      .select("id, name, photo_url, team:teams(id, name, short_name, primary_color, secondary_color, logo_url)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("match_events")
      .select("match_id, player_id, assist_player_id, event_type")
      .or(`player_id.eq.${params.id},assist_player_id.eq.${params.id}`),
    supabase
      .from("matches")
      .select(
        "id, status, home_team_id, away_team_id, home_score, away_score, kickoff_at, bracket_position, round:rounds(id, name, display_order)",
      ),
  ]);
  const player = playerRes.data as any;
  if (!player) notFound();
  const team = player.team as Team | null;
  const teamId = team?.id ?? null;

  const allEvents = (eventsRes.data ?? []) as Array<{
    match_id: string;
    player_id: string | null;
    assist_player_id: string | null;
    event_type: string;
  }>;
  const allMatches = (matchesRes.data ?? []) as Array<{
    id: string;
    status: string;
    home_team_id: string | null;
    away_team_id: string | null;
    home_score: number | null;
    away_score: number | null;
    kickoff_at: string | null;
    bracket_position: string | null;
    round: { id: string; name: string; display_order: number } | null;
  }>;
  const matchById = new Map(allMatches.map((m) => [m.id, m]));

  // Lookup all teams (for opponent crest in per-match list)
  const teamIds = new Set<string>();
  for (const m of allMatches) {
    if (m.home_team_id) teamIds.add(m.home_team_id);
    if (m.away_team_id) teamIds.add(m.away_team_id);
  }
  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, short_name, primary_color, secondary_color, logo_url")
    .in("id", Array.from(teamIds));
  const teamMap = new Map<string, Team>(
    ((teamRows ?? []) as Team[]).map((t) => [t.id, t]),
  );

  // Career totals from match_events
  const totals = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, own_goals: 0 };
  for (const e of allEvents) {
    if (e.event_type === "goal" && e.player_id === params.id) totals.goals++;
    if (e.event_type === "goal" && e.assist_player_id === params.id) totals.assists++;
    if (e.event_type === "yellow_card" && e.player_id === params.id) totals.yellow_cards++;
    if (e.event_type === "red_card" && e.player_id === params.id) totals.red_cards++;
    if (e.event_type === "own_goal" && e.player_id === params.id) totals.own_goals++;
  }

  // Per-match aggregation for finished matches the player's team played in.
  type Row = {
    match_id: string;
    kickoff_at: string | null;
    round_name: string | null;
    opponent: Team | null;
    is_home: boolean;
    our_score: number | null;
    their_score: number | null;
    goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
    own_goals: number;
    won: boolean;
    drew: boolean;
    clean_sheet: boolean;
    points: number;
  };
  const rows: Row[] = [];
  let careerWins = 0;
  let careerDraws = 0;
  let careerCleanSheets = 0;
  if (teamId) {
    for (const m of allMatches) {
      if (m.status !== "finished") continue;
      if (m.home_team_id !== teamId && m.away_team_id !== teamId) continue;
      const isHome = m.home_team_id === teamId;
      const opp = isHome ? m.away_team_id : m.home_team_id;
      const opponent = opp ? teamMap.get(opp) ?? null : null;
      const our = isHome ? m.home_score : m.away_score;
      const their = isHome ? m.away_score : m.home_score;
      const won = (our ?? 0) > (their ?? 0);
      const drew = (our ?? 0) === (their ?? 0);
      const clean = (their ?? 0) === 0;
      if (won) careerWins++;
      else if (drew) careerDraws++;
      if (clean) careerCleanSheets++;

      let g = 0, a = 0, y = 0, r = 0, og = 0;
      for (const e of allEvents) {
        if (e.match_id !== m.id) continue;
        if (e.event_type === "goal" && e.player_id === params.id) g++;
        if (e.event_type === "goal" && e.assist_player_id === params.id) a++;
        if (e.event_type === "yellow_card" && e.player_id === params.id) y++;
        if (e.event_type === "red_card" && e.player_id === params.id) r++;
        if (e.event_type === "own_goal" && e.player_id === params.id) og++;
      }
      const points =
        g * 3
        + a * 2
        + (won ? 1 : 0)
        + (clean ? 1 : 0)
        - y
        - r * 2
        - og;
      rows.push({
        match_id: m.id,
        kickoff_at: m.kickoff_at,
        round_name: m.round?.name ?? null,
        opponent,
        is_home: isHome,
        our_score: our,
        their_score: their,
        goals: g,
        assists: a,
        yellow_cards: y,
        red_cards: r,
        own_goals: og,
        won,
        drew,
        clean_sheet: clean,
        points,
      });
    }
  }
  rows.sort((a, b) => (b.kickoff_at ?? "").localeCompare(a.kickoff_at ?? ""));
  const totalPoints = rows.reduce((acc, r) => acc + r.points, 0);

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-4">
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photo_url}
          teamPrimary={team?.primary_color}
          size={72}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{player.name}</h1>
          <p className="text-sm text-zinc-500 inline-flex items-center gap-2 mt-0.5">
            {team ? (
              <>
                <TeamCrest
                  name={team.name}
                  shortName={team.short_name}
                  primaryColor={team.primary_color}
                  secondaryColor={team.secondary_color}
                  logoUrl={team.logo_url}
                  size={20}
                />
                <span className="truncate">{team.name}</span>
              </>
            ) : (
              "Bez tima"
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-zinc-500">Bodovi</div>
          <div className="text-3xl font-black tabular-nums text-emerald-300">{totalPoints}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {(
          [
            ["Golovi", totals.goals],
            ["Asistencije", totals.assists],
            ["Č. mreža", careerCleanSheets],
            ["Pobede", careerWins],
            ["🟨", totals.yellow_cards],
            ["🟥", totals.red_cards],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="card text-center">
            <div className="text-2xl font-bold tabular-nums">{v}</div>
            <div className="text-xs text-zinc-500">{l}</div>
          </div>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="card !p-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 font-semibold flex items-center justify-between">
            <span>Učinak po mečevima</span>
            <span>
              {rows.length} {rows.length === 1 ? "meč" : "mečeva"}
            </span>
          </div>
          <ul className="divide-y divide-zinc-800">
            {rows.map((r) => (
              <li key={r.match_id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <div className="text-[10px] text-zinc-500 hidden sm:block w-20 shrink-0">
                  {r.kickoff_at ? formatKickoff(r.kickoff_at) : r.round_name ?? ""}
                </div>
                <span className="text-zinc-500 shrink-0">vs</span>
                {r.opponent && (
                  <TeamCrest
                    name={r.opponent.name}
                    shortName={r.opponent.short_name}
                    primaryColor={r.opponent.primary_color}
                    secondaryColor={r.opponent.secondary_color}
                    logoUrl={r.opponent.logo_url}
                    size={16}
                  />
                )}
                <span className="font-medium truncate flex-1">{r.opponent?.name ?? "?"}</span>
                <span className="tabular-nums shrink-0 text-zinc-300">
                  {r.our_score}:{r.their_score}
                </span>
                <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:inline w-20 text-right">
                  {r.goals > 0 && `${r.goals}G `}
                  {r.assists > 0 && `${r.assists}A `}
                  {r.yellow_cards > 0 && "🟨"}
                  {r.red_cards > 0 && "🟥"}
                </span>
                <span
                  className={`tabular-nums font-bold w-12 text-right shrink-0 ${
                    r.points > 0 ? "text-emerald-300" : r.points < 0 ? "text-red-300" : "text-zinc-400"
                  }`}
                >
                  {r.points > 0 ? `+${r.points}` : r.points}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="card text-sm text-zinc-500 italic text-center py-6">
          Igrač još nije odigrao ni jedan meč.
        </div>
      )}
    </div>
  );
}
