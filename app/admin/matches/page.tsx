import { createClient } from "@/lib/supabase/server";
import { MatchesAdmin } from "./MatchesAdmin";

export const revalidate = 0;

export default async function MatchesAdminPage() {
  const supabase = createClient();
  const [{ data: matches }, { data: rounds }, { data: scheduleMatches }] = await Promise.all([
    supabase
      .from("matches")
      .select("*, home:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url), away:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url), round:rounds(id,name,display_order,stage,status)")
      .order("kickoff_at"),
    supabase.from("rounds").select("id, name, status, display_order, stage").order("display_order"),
    supabase
      .from("matches")
      .select("id, round_id, home_team_id, away_team_id, status, phase, kickoff_at, home:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url), away:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url)")
      .order("kickoff_at"),
  ]);

  return (
    <MatchesAdmin
      matches={(matches ?? []) as any[]}
      rounds={(rounds ?? []) as any[]}
      scheduleMatches={(scheduleMatches ?? []) as any[]}
    />
  );
}
