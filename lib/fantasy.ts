import "server-only";
import { createClient } from "@/lib/supabase/server";
import { BASE_PRICE, type FantasyOverview, type LeagueRanking, type PlayerForPicker, type RoundLite } from "@/lib/fantasy-shared";

export { FANTASY_BUDGET, BASE_PRICE, MIN_PRICE } from "@/lib/fantasy-shared";
export type { RoundLite, PlayerForPicker, LeagueRanking, FantasyOverview };

/**
 * For a given user, compute their fantasy overview: totals, last round, ranks across leagues.
 */
export async function getFantasyOverview(user_id: string): Promise<FantasyOverview> {
  const supabase = createClient();
  const [roundsRes, allFRPRes, myLeaguesRes, allLeagueMembersRes] = await Promise.all([
    supabase.from("rounds").select("id, name, status, display_order").order("display_order"),
    supabase.from("fantasy_round_points").select("user_id, round_id, total_points"),
    supabase
      .from("fantasy_league_members")
      .select("league_id, league:fantasy_leagues(id, name, invite_code)")
      .eq("user_id", user_id),
    supabase.from("fantasy_league_members").select("league_id, user_id"),
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

  const allUsers = new Set([...totalsByUser.keys()]);
  const { data: snapUsers } = await supabase.from("fantasy_team_snapshots").select("user_id");
  for (const u of (snapUsers ?? []) as Array<{ user_id: string }>) allUsers.add(u.user_id);
  const ranking = Array.from(allUsers)
    .map((u) => ({ user_id: u, total: totalsByUser.get(u) ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const myOverallRank = ranking.findIndex((r) => r.user_id === user_id);

  const myLeagues = ((myLeaguesRes.data ?? []) as any[]).map((m) => m.league).filter(Boolean);
  const membersByLeague = new Map<string, string[]>();
  for (const m of (allLeagueMembersRes.data ?? []) as Array<{ league_id: string; user_id: string }>) {
    const arr = membersByLeague.get(m.league_id) ?? [];
    arr.push(m.user_id);
    membersByLeague.set(m.league_id, arr);
  }
  const leagues: LeagueRanking[] = myLeagues.map((l: any) => {
    const memberIds = membersByLeague.get(l.id) ?? [];
    const sorted = memberIds
      .map((uid) => ({ uid, total: totalsByUser.get(uid) ?? 0 }))
      .sort((a, b) => b.total - a.total);
    const idx = sorted.findIndex((x) => x.uid === user_id);
    return {
      league_id: l.id,
      league_name: l.name,
      invite_code: l.invite_code,
      member_count: memberIds.length,
      my_rank: idx + 1,
      my_total: myTotal,
    };
  });

  return {
    total_points: myTotal,
    last_round_points: lastRoundPoints,
    last_round_name: lastRoundName,
    overall_rank: myOverallRank === -1 ? null : myOverallRank + 1,
    overall_total: ranking.length,
    leagues,
    next_round: nextRound,
    active_round: activeRound,
    last_finished_round: lastFinished,
  };
}

export async function getPlayersForPicker(): Promise<PlayerForPicker[]> {
  const supabase = createClient();
  const [playersRes, teamsRes, priceRes, fppRes, fppAllRes, ftRes, roundsRes] = await Promise.all([
    supabase.from("players").select("id, name, team_id, photo_url").order("name"),
    supabase.from("teams").select("id, name, primary_color"),
    supabase.from("player_prices").select("player_id, price, round_id, round:rounds(display_order)"),
    supabase.from("fantasy_player_points").select("player_id, round_id, total_points, round:rounds(display_order, status)"),
    supabase.from("fantasy_player_points").select("player_id, total_points"),
    supabase.from("fantasy_teams").select("player1_id, player2_id, player3_id"),
    supabase.from("rounds").select("id, status, display_order").order("display_order"),
  ]);

  const players = (playersRes.data ?? []) as Array<{ id: string; name: string; team_id: string | null; photo_url: string | null }>;
  const teams = (teamsRes.data ?? []) as Array<{ id: string; name: string; primary_color: string | null }>;
  const teamMap = new Map(teams.map((t) => [t.id, t]));

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
    };
  });
}
