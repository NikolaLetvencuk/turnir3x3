import { createClient } from "@/lib/supabase/server";
import { getWildcardReport } from "@/lib/resolveBracket";
import { BracketAdmin } from "./BracketAdmin";

export const revalidate = 0;

export default async function BracketAdminPage() {
  const supabase = createClient();
  const [{ data: groups }, { data: teams }, { data: rounds }, { data: matches }, { data: state }] = await Promise.all([
    supabase.from("groups").select("id, name, display_order").order("display_order"),
    supabase.from("teams").select("id, name, short_name, primary_color, secondary_color").order("name"),
    supabase.from("rounds").select("id, name, display_order").eq("stage", "knockout").order("display_order"),
    supabase
      .from("matches")
      .select("id, round_id, bracket_position, home_team_id, away_team_id, home_placeholder, away_placeholder, home_team_id_manual, away_team_id_manual, home_score, away_score, phase, kickoff_at, knockout_winner_id, home_team:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color), away_team:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color)")
      .not("bracket_position", "is", null),
    supabase.from("tournament_state").select("*").eq("id", true).maybeSingle(),
  ]);

  const groupsList = (groups ?? []) as any[];
  const stateRow = (state ?? null) as any;
  const advancingPerGroup = stateRow?.advancing_per_group ?? 1;
  const totalAdvancing =
    stateRow?.advancing_per_group != null
      ? stateRow.advancing_per_group * groupsList.length + (stateRow.best_thirds ?? 0)
      : 0;
  const neededWildcards = stateRow?.best_thirds ?? 0;
  const wildcardReport = neededWildcards > 0 && groupsList.length > 0
    ? await getWildcardReport(neededWildcards, advancingPerGroup)
    : null;

  return (
    <BracketAdmin
      groups={groupsList}
      teams={(teams ?? []) as any[]}
      rounds={(rounds ?? []) as any[]}
      matches={(matches ?? []) as any[]}
      state={stateRow}
      wildcardReport={wildcardReport}
      totalAdvancing={totalAdvancing}
    />
  );
}
