import { createClient } from "@/lib/supabase/server";

export type StandingRow = {
  team_id: string;
  team_name: string;
  short_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url?: string | null;
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
  const [groupsRes, teamsRes, gtRes, sviewRes] = await Promise.all([
    supabase.from("groups").select("id, name, display_order").order("display_order"),
    supabase.from("teams").select("id, name, short_name, primary_color, secondary_color, logo_url"),
    supabase.from("group_teams").select("group_id, team_id"),
    supabase.from("standings").select("*"),
  ]);
  const groups = (groupsRes.data ?? []) as Array<{ id: string; name: string; display_order: number }>;
  const teams = (teamsRes.data ?? []) as Array<{ id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null; logo_url?: string | null }>;
  const gt = (gtRes.data ?? []) as Array<{ group_id: string; team_id: string }>;
  const sv = (sviewRes.data ?? []) as Array<{ team_id: string; group_id: string | null; played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number; goal_diff: number; points: number }>;

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const standingsByKey = new Map(sv.map((r) => [`${r.team_id}_${r.group_id ?? "_"}`, r]));

  return groups.map((g) => {
    const teamsInGroup = gt.filter((x) => x.group_id === g.id);
    const rows: StandingRow[] = teamsInGroup.map((x) => {
      const t = teamMap.get(x.team_id);
      const stat = standingsByKey.get(`${x.team_id}_${g.id}`);
      return {
        team_id: x.team_id,
        team_name: t?.name ?? "?",
        short_name: t?.short_name ?? null,
        primary_color: t?.primary_color ?? null,
        secondary_color: t?.secondary_color ?? null,
        logo_url: (t as any)?.logo_url ?? null,
        played: stat?.played ?? 0,
        won: stat?.wins ?? 0,
        drawn: stat?.draws ?? 0,
        lost: stat?.losses ?? 0,
        goals_for: stat?.goals_for ?? 0,
        goals_against: stat?.goals_against ?? 0,
        goal_diff: stat?.goal_diff ?? 0,
        points: stat?.points ?? 0,
      };
    });
    rows.sort((a, b) =>
      b.points - a.points
      || b.goal_diff - a.goal_diff
      || b.goals_for - a.goals_for
      || a.goals_against - b.goals_against
      || a.team_name.localeCompare(b.team_name)
    );
    return { group_id: g.id, group_name: g.name, display_order: g.display_order, rows };
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
