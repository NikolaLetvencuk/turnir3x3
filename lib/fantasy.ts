import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BASE_PRICE, DEFAULT_BUDGET, type FantasyOverview, type LeagueRanking, type PlayerForPicker, type RoundLite } from "@/lib/fantasy-shared";

export { FANTASY_BUDGET, DEFAULT_BUDGET, BASE_PRICE, MIN_PRICE } from "@/lib/fantasy-shared";
export type { RoundLite, PlayerForPicker, LeagueRanking, FantasyOverview };

/**
 * User's budget for the upcoming round = sum of CURRENT (latest) prices of the players
 * in their most recent locked snapshot. If no snapshot yet, defaults to 30.
 */
/**
 * Budget = team value (sum of latest player prices) + leftover bank from last lock.
 * For users without any snapshot, return DEFAULT_BUDGET (30).
 */
export async function getUserBudget(user_id: string): Promise<{ budget: number; bank: number; team_value: number }> {
  const admin = createAdminClient();
  const { data: snaps } = await admin
    .from("fantasy_team_snapshots")
    .select("player1_id, player2_id, player3_id, bank, round:rounds(display_order)")
    .eq("user_id", user_id);
  const list = ((snaps ?? []) as any[])
    .map((s) => ({ ...s, order: s.round?.display_order ?? 0 }))
    .sort((a, b) => b.order - a.order);
  if (list.length === 0) return { budget: DEFAULT_BUDGET, bank: 0, team_value: 0 };
  const latest = list[0];
  const ids = [latest.player1_id, latest.player2_id, latest.player3_id].filter(Boolean) as string[];
  const bank = Number(latest.bank ?? 0);
  if (ids.length === 0) return { budget: DEFAULT_BUDGET, bank, team_value: 0 };

  const { data: prices } = await admin
    .from("player_prices")
    .select("player_id, price, round:rounds(display_order)")
    .in("player_id", ids);
  const latestPrice = new Map<string, { price: number; order: number }>();
  for (const p of ((prices ?? []) as any[])) {
    const order = p.round?.display_order ?? 0;
    const cur = latestPrice.get(p.player_id);
    if (!cur || cur.order < order) latestPrice.set(p.player_id, { price: Number(p.price), order });
  }
  const team_value = ids.reduce((acc, id) => acc + (latestPrice.get(id)?.price ?? BASE_PRICE), 0);
  const budget = Math.round((team_value + bank) * 100) / 100;
  return { budget, bank, team_value };
}

/**
 * For a given user, compute their fantasy overview: totals, last round, ranks across leagues.
 */
// Assign 1-based ranks where ties share the same rank ("1, 1, 3" pattern).
export function rankWithTies<T extends { total: number }>(items: T[]): Array<T & { rank: number }> {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const out: Array<T & { rank: number }> = [];
  let prevTotal: number | null = null;
  let prevRank = 0;
  sorted.forEach((x, i) => {
    let rank: number;
    if (prevTotal === null || x.total !== prevTotal) {
      rank = i + 1;
      prevRank = rank;
      prevTotal = x.total;
    } else {
      rank = prevRank;
    }
    out.push({ ...x, rank });
  });
  return out;
}

export async function getFantasyOverview(user_id: string): Promise<FantasyOverview> {
  const supabase = createAdminClient();
  const [roundsRes, allFRPRes, allLeagueMembersRes, allLeaguesRes] = await Promise.all([
    supabase.from("rounds").select("id, name, status, display_order, locked_at").order("display_order"),
    supabase.from("fantasy_round_points").select("user_id, round_id, total_points"),
    supabase.from("fantasy_league_members").select("league_id, user_id, joined_at"),
    supabase.from("fantasy_leagues").select("id, name, invite_code"),
  ]);

  const rounds = (roundsRes.data ?? []) as RoundLite[];
  const allFRP = (allFRPRes.data ?? []) as Array<{ user_id: string; round_id: string; total_points: number }>;

  const activeRound = rounds.find((r) => r.status === "active") ?? null;
  const upcomingRounds = rounds.filter((r) => r.status === "upcoming");
  const finishedRounds = rounds.filter((r) => r.status === "finished");
  const nextRound = upcomingRounds[0] ?? null;
  const lastFinished = finishedRounds[finishedRounds.length - 1] ?? null;

  const totalsByUser = new Map<string, number>();
  for (const f of allFRP) totalsByUser.set(f.user_id, (totalsByUser.get(f.user_id) ?? 0) + (f.total_points ?? 0));
  const myTotal = totalsByUser.get(user_id) ?? 0;

  let lastRoundPoints: number | null = null;
  let lastRoundName: string | null = null;
  if (lastFinished) {
    const my = allFRP.find((f) => f.user_id === user_id && f.round_id === lastFinished.id);
    lastRoundPoints = my?.total_points ?? 0;
    lastRoundName = lastFinished.name;
  }
  let activeRoundPoints: number | null = null;
  if (activeRound) {
    const my = allFRP.find((f) => f.user_id === user_id && f.round_id === activeRound.id);
    activeRoundPoints = my?.total_points ?? 0;
  }

  const allUsers = new Set([...totalsByUser.keys()]);
  const { data: snapUsers } = await supabase.from("fantasy_team_snapshots").select("user_id");
  for (const u of (snapUsers ?? []) as Array<{ user_id: string }>) allUsers.add(u.user_id);
  const ranking = rankWithTies(
    Array.from(allUsers).map((u) => ({ user_id: u, total: totalsByUser.get(u) ?? 0 })),
  );
  const myRow = ranking.find((r) => r.user_id === user_id);
  const myOverallRank = myRow ? myRow.rank : -1;

  const allLeagueMembers = (allLeagueMembersRes.data ?? []) as Array<{ league_id: string; user_id: string; joined_at: string }>;
  const myLeagueIds = new Set(allLeagueMembers.filter((m) => m.user_id === user_id).map((m) => m.league_id));
  const myLeagues = ((allLeaguesRes.data ?? []) as Array<{ id: string; name: string; invite_code: string }>)
    .filter((l) => myLeagueIds.has(l.id));
  const membersByLeague = new Map<string, Array<{ user_id: string; joined_at: string }>>();
  for (const m of allLeagueMembers) {
    const arr = membersByLeague.get(m.league_id) ?? [];
    arr.push({ user_id: m.user_id, joined_at: m.joined_at });
    membersByLeague.set(m.league_id, arr);
  }
  // For league points, count only rounds whose lock time is AFTER the member joined.
  const roundLockedAt = new Map<string, string | null>(rounds.map((r: any) => [r.id, r.locked_at]));
  function leagueTotalForMember(uid: string, joined_at: string): number {
    let sum = 0;
    for (const f of allFRP) {
      if (f.user_id !== uid) continue;
      const locked = roundLockedAt.get(f.round_id);
      if (!locked) continue; // round never started → no points anyway
      if (new Date(locked).getTime() > new Date(joined_at).getTime()) {
        sum += f.total_points ?? 0;
      }
    }
    return sum;
  }
  const leagues: LeagueRanking[] = myLeagues.map((l) => {
    const members = membersByLeague.get(l.id) ?? [];
    const ranked = rankWithTies(
      members.map((m) => ({
        user_id: m.user_id,
        joined_at: m.joined_at,
        total: leagueTotalForMember(m.user_id, m.joined_at),
      })),
    );
    const me = ranked.find((r) => r.user_id === user_id);
    return {
      league_id: l.id,
      league_name: l.name,
      invite_code: l.invite_code,
      member_count: members.length,
      my_rank: me ? me.rank : members.length + 1,
      my_total: me?.total ?? 0,
    };
  });

  return {
    total_points: myTotal,
    last_round_points: lastRoundPoints,
    last_round_name: lastRoundName,
    overall_rank: myOverallRank === -1 ? null : myOverallRank,
    overall_total: ranking.length,
    leagues,
    next_round: nextRound,
    active_round: activeRound,
    active_round_points: activeRoundPoints,
    last_finished_round: lastFinished,
  };
}

export async function getPlayersForPicker(): Promise<PlayerForPicker[]> {
  const supabase = createClient();
  const [playersRes, teamsRes, priceRes, fppRes, fppAllRes, ftRes, roundsRes, upcomingRes] = await Promise.all([
    supabase.from("players").select("id, name, team_id, photo_url").order("name"),
    supabase.from("teams").select("id, name, short_name, primary_color, secondary_color"),
    supabase.from("player_prices").select("player_id, price, round_id, round:rounds(display_order)"),
    supabase.from("fantasy_player_points").select("player_id, round_id, total_points, round:rounds(display_order, status)"),
    supabase.from("fantasy_player_points").select("player_id, total_points"),
    supabase.from("fantasy_teams").select("player1_id, player2_id, player3_id"),
    supabase.from("rounds").select("id, status, display_order").order("display_order"),
    supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, kickoff_at, phase, home_team:teams!matches_home_team_id_fkey(id, name, short_name, primary_color, secondary_color), away_team:teams!matches_away_team_id_fkey(id, name, short_name, primary_color, secondary_color)")
      .eq("phase", "scheduled")
      .order("kickoff_at", { ascending: true, nullsFirst: false }),
  ]);

  const players = (playersRes.data ?? []) as Array<{ id: string; name: string; team_id: string | null; photo_url: string | null }>;
  const teams = (teamsRes.data ?? []) as Array<{ id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null }>;
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // Next 3 scheduled fixtures per team
  const upcomingByTeam = new Map<string, Array<{ match_id: string; opponent_name: string; opponent_short_name: string | null; opponent_primary: string | null; opponent_secondary: string | null; is_home: boolean; kickoff_at: string | null }>>();
  for (const m of ((upcomingRes.data ?? []) as any[])) {
    if (m.home_team_id && m.away_team) {
      const arr = upcomingByTeam.get(m.home_team_id) ?? [];
      if (arr.length < 3) arr.push({
        match_id: m.id,
        opponent_name: m.away_team.name,
        opponent_short_name: m.away_team.short_name,
        opponent_primary: m.away_team.primary_color,
        opponent_secondary: m.away_team.secondary_color,
        is_home: true,
        kickoff_at: m.kickoff_at,
      });
      upcomingByTeam.set(m.home_team_id, arr);
    }
    if (m.away_team_id && m.home_team) {
      const arr = upcomingByTeam.get(m.away_team_id) ?? [];
      if (arr.length < 3) arr.push({
        match_id: m.id,
        opponent_name: m.home_team.name,
        opponent_short_name: m.home_team.short_name,
        opponent_primary: m.home_team.primary_color,
        opponent_secondary: m.home_team.secondary_color,
        is_home: false,
        kickoff_at: m.kickoff_at,
      });
      upcomingByTeam.set(m.away_team_id, arr);
    }
  }

  const priceMap = new Map<string, { price: number; order: number }>();
  for (const p of ((priceRes.data ?? []) as any[])) {
    const order = p.round?.display_order ?? 0;
    const cur = priceMap.get(p.player_id);
    if (!cur || cur.order < order) priceMap.set(p.player_id, { price: Number(p.price), order });
  }

  const lastFinishedRound = ((roundsRes.data ?? []) as any[]).filter((r) => r.status === "finished").pop();
  const lastRoundPointsMap = new Map<string, number>();
  if (lastFinishedRound) {
    for (const fpp of ((fppRes.data ?? []) as any[])) {
      if (fpp.round_id === lastFinishedRound.id) lastRoundPointsMap.set(fpp.player_id, fpp.total_points ?? 0);
    }
  }

  const totalPointsMap = new Map<string, number>();
  for (const f of ((fppAllRes.data ?? []) as any[])) {
    totalPointsMap.set(f.player_id, (totalPointsMap.get(f.player_id) ?? 0) + (f.total_points ?? 0));
  }

  const fts = (ftRes.data ?? []) as Array<{ player1_id: string | null; player2_id: string | null; player3_id: string | null }>;
  const totalTeams = fts.length;
  const ownedMap = new Map<string, number>();
  for (const ft of fts) {
    for (const pid of [ft.player1_id, ft.player2_id, ft.player3_id]) {
      if (pid) ownedMap.set(pid, (ownedMap.get(pid) ?? 0) + 1);
    }
  }

  return players.map((p) => {
    const team = p.team_id ? teamMap.get(p.team_id) : null;
    const price = priceMap.get(p.id)?.price ?? BASE_PRICE;
    return {
      id: p.id,
      name: p.name,
      team_id: p.team_id,
      team_name: team?.name ?? null,
      team_primary: team?.primary_color ?? null,
      photo_url: p.photo_url,
      price,
      last_round_points: lastFinishedRound ? lastRoundPointsMap.get(p.id) ?? 0 : null,
      total_points: totalPointsMap.get(p.id) ?? 0,
      ownership_pct: totalTeams > 0 ? Math.round((ownedMap.get(p.id) ?? 0) / totalTeams * 100) : 0,
      next_fixtures: p.team_id ? upcomingByTeam.get(p.team_id) ?? [] : [],
    };
  });
}
