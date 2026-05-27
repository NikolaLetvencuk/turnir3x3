import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { belgradeLocalToUTCISO } from "@/lib/utils";
import {
  DailyTeamEditor,
  type PlayerForPicker,
  type PlayerStats,
  type TeamMatchToday,
  type PlayerMatchEntry,
} from "./DailyTeamEditor";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function belgradeTodayKey(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function shiftDayUTC(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function belgradeDayRange(day: string) {
  const startUTC = belgradeLocalToUTCISO(`${day}T00:00`);
  const nextKey = shiftDayUTC(day, 1);
  const endUTC = belgradeLocalToUTCISO(`${nextKey}T00:00`);
  return { startUTC: startUTC ?? "", endUTC: endUTC ?? "" };
}

export default async function TeamPage({ searchParams }: { searchParams: { day?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/team");

  const today = belgradeTodayKey();
  const admin = createAdminClient();

  // ---- Determine the user's *editable* day --------------------------------
  // Pick the next "active" day from today onwards:
  //  1. If today has matches AND the first one hasn't started → today.
  //  2. Otherwise look forward for the next day with at least one
  //     scheduled match. We don't pre-pick "tomorrow" because the next
  //     active day may be days/weeks away (pre-tournament use case).
  //  3. If no future matches exist at all, fall back to tomorrow as a
  //     placeholder so the picker is still usable.
  const todayRange = belgradeDayRange(today);
  const [{ data: todayMatchesRaw }, { data: futureMatchesRaw }] = await Promise.all([
    admin
      .from("matches")
      .select("status, kickoff_at")
      .gte("kickoff_at", todayRange.startUTC)
      .lt("kickoff_at", todayRange.endUTC),
    admin
      .from("matches")
      .select("kickoff_at")
      .gte("kickoff_at", todayRange.endUTC)
      .order("kickoff_at", { ascending: true })
      .limit(50),
  ]);
  const todayMatches = (todayMatchesRaw ?? []) as Array<{ status: string }>;
  const todayHasMatches = todayMatches.length > 0;
  const todayStarted = todayMatches.some((m) => m.status && m.status !== "scheduled");

  function belgradeKeyOf(iso: string): string {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Belgrade",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(new Date(iso));
  }
  const futureDays = Array.from(
    new Set(((futureMatchesRaw ?? []) as Array<{ kickoff_at: string | null }>)
      .filter((r) => r.kickoff_at)
      .map((r) => belgradeKeyOf(r.kickoff_at!))),
  ).sort();
  const nextFutureDay = futureDays[0] ?? null;

  const editableDay = todayHasMatches && !todayStarted
    ? today
    : nextFutureDay
    ? nextFutureDay
    : shiftDayUTC(today, 1);

  // ---- Resolve requested day, clamp to allowed range ----------------------
  let day = searchParams.day && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.day) ? searchParams.day : editableDay;
  // Don't allow navigating past the editable day — future beyond that is empty.
  if (day > editableDay) day = editableDay;

  const range = belgradeDayRange(day);

  const [
    playersRes,
    matchesRes,
    dayPickRes,
    latestPickRes,
    teamRes,
    daysWithPicksRes,
    eventsRes,
    finishedMatchesRes,
  ] = await Promise.all([
    admin
      .from("players")
      .select(
        "id, name, team_id, photo_url, team:teams!players_team_id_fkey(id, name, short_name, primary_color, secondary_color, logo_url)",
      )
      .order("name"),
    admin
      .from("matches")
      .select(
        "id, status, bracket_position, kickoff_at, home_team_id, away_team_id, home_score, away_score",
      )
      .gte("kickoff_at", range.startUTC)
      .lt("kickoff_at", range.endUTC)
      .order("kickoff_at"),
    (admin as any)
      .from("fantasy_day_picks")
      .select("*")
      .eq("user_id", profile.id)
      .eq("day", day)
      .maybeSingle(),
    (admin as any)
      .from("fantasy_day_picks")
      .select("*")
      .eq("user_id", profile.id)
      .lt("day", day)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("fantasy_teams").select("name").eq("user_id", profile.id).maybeSingle(),
    (admin as any)
      .from("fantasy_day_picks")
      .select("day")
      .eq("user_id", profile.id)
      .order("day", { ascending: false }),
    admin.from("match_events").select("match_id, player_id, assist_player_id, event_type"),
    admin
      .from("matches")
      .select(
        "id, status, home_team_id, away_team_id, home_score, away_score, kickoff_at, bracket_position",
      )
      .order("kickoff_at", { ascending: false }),
  ]);

  const players = (playersRes.data ?? []) as PlayerForPicker[];
  const matches = (matchesRes.data ?? []) as Array<{
    id: string;
    status: string;
    bracket_position: string | null;
    kickoff_at: string | null;
    home_team_id: string | null;
    away_team_id: string | null;
    home_score: number | null;
    away_score: number | null;
  }>;
  const dayPick = (dayPickRes.data ?? null) as any;
  const fallbackPick = (latestPickRes.data ?? null) as any;
  const teamName = ((teamRes.data ?? null) as any)?.name ?? null;

  const isLockedForToday = matches.some((m) => m.status && m.status !== "scheduled");
  const isKnockoutPlus = matches.some(
    (m) => m.bracket_position && !m.bracket_position.startsWith("R16"),
  );

  const playingTeamIds = Array.from(
    new Set(
      matches.flatMap((m) => [m.home_team_id, m.away_team_id]).filter((id): id is string => !!id),
    ),
  );

  const events = (eventsRes.data ?? []) as Array<{
    match_id: string;
    player_id: string | null;
    assist_player_id: string | null;
    event_type: string;
  }>;
  const allMatches = (finishedMatchesRes.data ?? []) as Array<{
    id: string;
    status: string;
    home_team_id: string | null;
    away_team_id: string | null;
    home_score: number | null;
    away_score: number | null;
    kickoff_at: string | null;
    bracket_position: string | null;
  }>;

  // Team map for cheap lookups
  const teamById = new Map<string, NonNullable<PlayerForPicker["team"]>>();
  for (const p of players) if (p.team) teamById.set(p.team.id, p.team);

  // ---- Per-team match for the selected day -------------------------------
  // Each team plays at most once on a given day (usually). For info we just
  // remember opponent + kickoff + score so the picker can render "vs X 15:30".
  const teamMatchToday: Record<string, TeamMatchToday> = {};
  for (const m of matches) {
    if (!m.home_team_id || !m.away_team_id) continue;
    const home = teamById.get(m.home_team_id);
    const away = teamById.get(m.away_team_id);
    if (!home || !away) continue;
    teamMatchToday[m.home_team_id] = {
      opponent: away,
      kickoff_at: m.kickoff_at,
      status: m.status,
      our_score: m.home_score,
      their_score: m.away_score,
      bracket_position: m.bracket_position,
    };
    teamMatchToday[m.away_team_id] = {
      opponent: home,
      kickoff_at: m.kickoff_at,
      status: m.status,
      our_score: m.away_score,
      their_score: m.home_score,
      bracket_position: m.bracket_position,
    };
  }

  // ---- Per-player cumulative stats (for popup top section) ---------------
  const stats = new Map<string, PlayerStats>();
  function bump(id: string, key: keyof PlayerStats) {
    const s = stats.get(id) ?? {
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      own_goals: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      clean_sheets: 0,
    };
    (s[key] as number)++;
    stats.set(id, s);
  }
  for (const e of events) {
    if (e.event_type === "goal" && e.player_id) bump(e.player_id, "goals");
    if (e.event_type === "goal" && e.assist_player_id) bump(e.assist_player_id, "assists");
    if (e.event_type === "yellow_card" && e.player_id) bump(e.player_id, "yellow_cards");
    if (e.event_type === "red_card" && e.player_id) bump(e.player_id, "red_cards");
    if (e.event_type === "own_goal" && e.player_id) bump(e.player_id, "own_goals");
  }
  const teamAgg = new Map<string, { wins: number; draws: number; losses: number; clean_sheets: number }>();
  function teamBump(tid: string, key: "wins" | "draws" | "losses" | "clean_sheets") {
    const t = teamAgg.get(tid) ?? { wins: 0, draws: 0, losses: 0, clean_sheets: 0 };
    t[key]++;
    teamAgg.set(tid, t);
  }
  for (const m of allMatches) {
    if (m.status !== "finished") continue;
    if (!m.home_team_id || !m.away_team_id) continue;
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    if (hs > as) {
      teamBump(m.home_team_id, "wins");
      teamBump(m.away_team_id, "losses");
    } else if (as > hs) {
      teamBump(m.away_team_id, "wins");
      teamBump(m.home_team_id, "losses");
    } else {
      teamBump(m.home_team_id, "draws");
      teamBump(m.away_team_id, "draws");
    }
    if (as === 0) teamBump(m.home_team_id, "clean_sheets");
    if (hs === 0) teamBump(m.away_team_id, "clean_sheets");
  }
  for (const p of players) {
    if (!p.team_id) continue;
    const t = teamAgg.get(p.team_id);
    if (!t) continue;
    const s = stats.get(p.id) ?? {
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      own_goals: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      clean_sheets: 0,
    };
    s.wins = t.wins;
    s.draws = t.draws;
    s.losses = t.losses;
    s.clean_sheets = t.clean_sheets;
    stats.set(p.id, s);
  }
  const statsObj: Record<string, PlayerStats> = {};
  stats.forEach((v, k) => {
    statsObj[k] = v;
  });

  // ---- Per-player per-match history (for popup detail table) -------------
  // For each (player, match): goals/assists/cards + team_outcome + computed
  // fantasy points for that match. Sorted by kickoff_at desc.
  type PlayerMatchAcc = {
    match_id: string;
    kickoff_at: string | null;
    status: string;
    opponent: NonNullable<PlayerForPicker["team"]> | null;
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
  };
  const perPlayerMatch = new Map<string, Map<string, PlayerMatchAcc>>();
  function ensure(playerId: string, m: typeof allMatches[number], teamId: string): PlayerMatchAcc {
    const inner = perPlayerMatch.get(playerId) ?? new Map<string, PlayerMatchAcc>();
    perPlayerMatch.set(playerId, inner);
    if (!inner.has(m.id)) {
      const isHome = m.home_team_id === teamId;
      const oppId = isHome ? m.away_team_id : m.home_team_id;
      const opponent = oppId ? teamById.get(oppId) ?? null : null;
      inner.set(m.id, {
        match_id: m.id,
        kickoff_at: m.kickoff_at,
        status: m.status,
        opponent,
        is_home: isHome,
        our_score: isHome ? m.home_score : m.away_score,
        their_score: isHome ? m.away_score : m.home_score,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        own_goals: 0,
        won: false,
        drew: false,
        clean_sheet: false,
      });
    }
    return inner.get(m.id)!;
  }
  // Pre-seed entries for every finished match each player's team participated in.
  for (const p of players) {
    if (!p.team_id) continue;
    for (const m of allMatches) {
      if (m.status !== "finished") continue;
      if (m.home_team_id !== p.team_id && m.away_team_id !== p.team_id) continue;
      const acc = ensure(p.id, m, p.team_id);
      const isHome = acc.is_home;
      const hs = m.home_score ?? 0;
      const as = m.away_score ?? 0;
      if (hs > as) acc.won = isHome;
      else if (as > hs) acc.won = !isHome;
      acc.drew = hs === as;
      acc.clean_sheet = isHome ? as === 0 : hs === 0;
    }
  }
  // Layer in events.
  const matchById = new Map(allMatches.map((m) => [m.id, m]));
  for (const e of events) {
    const m = matchById.get(e.match_id);
    if (!m || m.status !== "finished") continue;
    if (e.event_type === "goal" && e.player_id) {
      const p = players.find((pp) => pp.id === e.player_id);
      if (p?.team_id) ensure(e.player_id, m, p.team_id).goals++;
    }
    if (e.event_type === "goal" && e.assist_player_id) {
      const p = players.find((pp) => pp.id === e.assist_player_id);
      if (p?.team_id) ensure(e.assist_player_id, m, p.team_id).assists++;
    }
    if (e.event_type === "yellow_card" && e.player_id) {
      const p = players.find((pp) => pp.id === e.player_id);
      if (p?.team_id) ensure(e.player_id, m, p.team_id).yellow_cards++;
    }
    if (e.event_type === "red_card" && e.player_id) {
      const p = players.find((pp) => pp.id === e.player_id);
      if (p?.team_id) ensure(e.player_id, m, p.team_id).red_cards++;
    }
    if (e.event_type === "own_goal" && e.player_id) {
      const p = players.find((pp) => pp.id === e.player_id);
      if (p?.team_id) ensure(e.player_id, m, p.team_id).own_goals++;
    }
  }
  // Convert to plain entries + compute fantasy points per match.
  const matchHistory: Record<string, PlayerMatchEntry[]> = {};
  perPlayerMatch.forEach((inner, playerId) => {
    const arr: PlayerMatchEntry[] = [];
    inner.forEach((acc) => {
      const points =
        acc.goals * 3
        + acc.assists * 2
        + (acc.won ? 1 : 0)
        + (acc.clean_sheet ? 1 : 0)
        - acc.yellow_cards
        - acc.red_cards * 2
        - acc.own_goals;
      arr.push({
        match_id: acc.match_id,
        kickoff_at: acc.kickoff_at,
        opponent_name: acc.opponent?.name ?? "?",
        opponent_short: acc.opponent?.short_name ?? null,
        opponent_primary: acc.opponent?.primary_color ?? null,
        opponent_secondary: acc.opponent?.secondary_color ?? null,
        opponent_logo_url: acc.opponent?.logo_url ?? null,
        our_score: acc.our_score,
        their_score: acc.their_score,
        is_home: acc.is_home,
        goals: acc.goals,
        assists: acc.assists,
        yellow_cards: acc.yellow_cards,
        red_cards: acc.red_cards,
        own_goals: acc.own_goals,
        won: acc.won,
        drew: acc.drew,
        clean_sheet: acc.clean_sheet,
        points,
      });
    });
    arr.sort((a, b) => (b.kickoff_at ?? "").localeCompare(a.kickoff_at ?? ""));
    matchHistory[playerId] = arr;
  });

  // Days the user has saved a team for — used for the "Pogledaj prošli tim" list.
  const savedDays = ((daysWithPicksRes.data ?? []) as Array<{ day: string }>)
    .map((r) => r.day)
    .filter((d) => d < day);

  const initialPicks = dayPick
    ? { player1_id: dayPick.player1_id, player2_id: dayPick.player2_id, player3_id: dayPick.player3_id }
    : fallbackPick
    ? { player1_id: fallbackPick.player1_id, player2_id: fallbackPick.player2_id, player3_id: fallbackPick.player3_id }
    : null;

  return (
    <DailyTeamEditor
      day={day}
      today={today}
      editableDay={editableDay}
      teamName={teamName}
      players={players}
      isLockedForToday={isLockedForToday}
      isKnockoutPlus={isKnockoutPlus}
      playingTeamIds={playingTeamIds}
      initialPicks={initialPicks}
      isCurrentDayPick={!!dayPick}
      fallbackDay={!dayPick && fallbackPick ? (fallbackPick.day as string) : null}
      savedDays={savedDays}
      matchCount={matches.length}
      stats={statsObj}
      teamMatchToday={teamMatchToday}
      matchHistory={matchHistory}
    />
  );
}
