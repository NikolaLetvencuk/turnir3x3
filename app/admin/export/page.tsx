import { createAdminClient } from "@/lib/supabase/admin";
import { getGroupStandings, getTopScorers } from "@/lib/standings";
import { ExportClient, type ExportMatch, type ExportRound } from "./ExportClient";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function AdminExportPage() {
  const admin = createAdminClient();

  const [{ data: roundsRaw }, { data: matchesRaw }, standings, scorers] = await Promise.all([
    admin.from("rounds").select("id, name, stage, status, display_order").order("display_order"),
    admin
      .from("matches")
      .select(`
        id, round_id, status, phase, home_score, away_score, home_pen, away_pen,
        kickoff_at, finished_at, bracket_position,
        home_placeholder, away_placeholder, knockout_winner_id,
        home_team:teams!matches_home_team_id_fkey(id, name, short_name, primary_color, secondary_color),
        away_team:teams!matches_away_team_id_fkey(id, name, short_name, primary_color, secondary_color)
      `)
      .order("kickoff_at"),
    getGroupStandings(),
    getTopScorers(10),
  ]);

  const rounds = (roundsRaw ?? []) as ExportRound[];
  const matches = (matchesRaw ?? []) as ExportMatch[];

  return (
    <ExportClient rounds={rounds} matches={matches} standings={standings} scorers={scorers} />
  );
}
