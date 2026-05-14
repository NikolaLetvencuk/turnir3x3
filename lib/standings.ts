import { createClient } from "@/lib/supabase/server";

export type StandingRow = {
  team_id: string;
  team_name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
};

export type GroupStandings = {
  group_id: string;
  group_name: string;
  display_order: number;
  rows: StandingRow[];
};

export async function getGroupStandings(): Promise<GroupStandings[]> {
  const supabase = createClient();
  const [groupsRes, teamsRes, gtRes, matchesRes] = await Promise.all([
    supabase.from("groups").select("id, name, display_order").order("display_order"),
    supabase.from("teams").select("id, name"),
    supabase.from("group_teams").select("group_id, team_id"),
    supabase.from("matches").select("id, group_id, home_team_id, away_team_id, home_score, away_score, status").eq("status", "finished"),
  ]);
  const groups = (groupsRes.data ?? []) as Array<{ id: string; name: string; display_order: number }>;
  const teams = (teamsRes.data ?? []) as Array<{ id: string; name: string }>;
  const gt = (gtRes.data ?? []) as Array<{ group_id: string; team_id: string }>;
  const matches = (matchesRes.data ?? []) as Array<{ id: string; group_id: string | null; home_team_id: string; away_team_id: string; home_score: number; away_score: number; status: string }>;

  if (groups.length === 0) return [];

  const teamMap = new Map(teams.map((t) => [t.id, t.name]));

  return groups.map((g) => {
    const teamsInGroup = gt.filter((x) => x.group_id === g.id);
    const rows = new Map<string, StandingRow>();
    for (const x of teamsInGroup) {
      rows.set(x.team_id, {
        team_id: x.team_id,
        team_name: teamMap.get(x.team_id) ?? "?",
        played: 0, won: 0, drawn: 0, lost: 0,
        goals_for: 0, goals_against: 0, goal_diff: 0, points: 0,
      });
    }
    const groupMatches = matches.filter((m) => m.group_id === g.id);
    for (const m of groupMatches) {
      const h = rows.get(m.home_team_id);
      const a = rows.get(m.away_team_id);
      if (!h || !a) continue;
      h.played++; a.played++;
      h.goals_for += m.home_score; h.goals_against += m.away_score;
      a.goals_for += m.away_score; a.goals_against += m.home_score;
      if (m.home_score > m.away_score) { h.won++; h.points += 3; a.lost++; }
      else if (m.home_score < m.away_score) { a.won++; a.points += 3; h.lost++; }
      else { h.drawn++; a.drawn++; h.points++; a.points++; }
    }
    const arr = Array.from(rows.values());
    for (const r of arr) r.goal_diff = r.goals_for - r.goals_against;
    arr.sort((x, y) =>
      y.points - x.points || y.goal_diff - x.goal_diff || y.goals_for - x.goals_for || x.team_name.localeCompare(y.team_name)
    );
    return {
      group_id: g.id,
      group_name: g.name,
      display_order: g.display_order,
      rows: arr,
    };
  });
}

export type TopScorerRow = {
  player_id: string;
  player_name: string;
  team_name: string | null;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
};

export async function getTopScorers(limit = 50): Promise<TopScorerRow[]> {
  const supabase = createClient();
  const [playersRes, eventsRes, teamsRes] = await Promise.all([
    supabase.from("players").select("id, name, team_id"),
    supabase.from("match_events").select("player_id, event_type, assist_player_id"),
    supabase.from("teams").select("id, name"),
  ]);
  const players = (playersRes.data ?? []) as Array<{ id: string; name: string; team_id: string | null }>;
  const events = (eventsRes.data ?? []) as Array<{ player_id: string; event_type: string; assist_player_id: string | null }>;
  const teams = (teamsRes.data ?? []) as Array<{ id: string; name: string }>;
  if (players.length === 0) return [];
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const stats = new Map<string, TopScorerRow>();
  for (const p of players) {
    stats.set(p.id, {
      player_id: p.id,
      player_name: p.name,
      team_name: p.team_id ? teamMap.get(p.team_id) ?? null : null,
      goals: 0, assists: 0, yellow_cards: 0, red_cards: 0,
    });
  }
  for (const e of events) {
    const s = stats.get(e.player_id);
    if (!s) continue;
    if (e.event_type === "goal") s.goals++;
    else if (e.event_type === "yellow_card") s.yellow_cards++;
    else if (e.event_type === "red_card") s.red_cards++;
    if (e.assist_player_id) {
      const a = stats.get(e.assist_player_id);
      if (a) a.assists++;
    }
  }
  return Array.from(stats.values())
    .filter((s) => s.goals + s.assists > 0)
    .sort((x, y) => y.goals - x.goals || y.assists - x.assists || x.player_name.localeCompare(y.player_name))
    .slice(0, limit);
}
