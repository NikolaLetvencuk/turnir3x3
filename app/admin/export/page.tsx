import { createAdminClient } from "@/lib/supabase/admin";
import { getGroupStandings, getTopScorers } from "@/lib/standings";
import { ExportClient, type ExportMatch, type ExportRound, type DrawGroup } from "./ExportClient";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function AdminExportPage() {
  const admin = createAdminClient();

  const [
    { data: roundsRaw },
    { data: matchesRaw },
    standings,
    scorers,
    { data: groupsRaw },
    { data: groupTeams },
    { data: teamsRaw },
  ] = await Promise.all([
    admin.from("rounds").select("id, name, stage, status, display_order").order("display_order"),
    admin
      .from("matches")
      .select(`
        id, round_id, status, phase, home_score, away_score, home_pen, away_pen,
        kickoff_at, finished_at, bracket_position,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, primary_color, secondary_color),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, primary_color, secondary_color)
      `)
      .order("kickoff_at"),
    getGroupStandings(),
    getTopScorers(10),
    admin.from("groups").select("id, name, display_order").order("display_order"),
    admin.from("group_teams").select("group_id, team_id"),
    admin.from("teams").select("id, name, short_name, primary_color, secondary_color"),
  ]);

  const rounds = (roundsRaw ?? []) as ExportRound[];
  const matches = (matchesRaw ?? []) as ExportMatch[];

  // Build draw groups from group_teams + teams. Letter the groups by
  // display_order so naming inconsistencies (e.g. "Grupa 9") still render
  // as "GRUPA I" on the poster.
  const teamById = new Map<string, any>(((teamsRaw ?? []) as any[]).map((t) => [t.id, t]));
  const teamsByGroup = new Map<string, any[]>();
  for (const gt of ((groupTeams ?? []) as any[])) {
    const t = teamById.get(gt.team_id);
    if (!t) continue;
    const arr = teamsByGroup.get(gt.group_id) ?? [];
    arr.push(t);
    teamsByGroup.set(gt.group_id, arr);
  }
  const drawGroups: DrawGroup[] = ((groupsRaw ?? []) as any[]).map((g, i) => {
    const letter = String.fromCharCode(65 + i);
    return {
      group_id: g.id,
      group_name: `Grupa ${letter}`,
      teams: (teamsByGroup.get(g.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  return (
    <ExportClient
      rounds={rounds}
      matches={matches}
      standings={standings}
      scorers={scorers}
      drawGroups={drawGroups}
    />
  );
}
