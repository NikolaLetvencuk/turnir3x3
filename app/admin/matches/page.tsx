import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MatchesAdmin } from "./MatchesAdmin";

export const revalidate = 0;

export default async function MatchesAdminPage() {
  const supabase = createClient();
  const [{ data: matches }, { data: teams }, { data: rounds }, { data: groups }] = await Promise.all([
    supabase.from("matches").select("*, home:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color), away:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color), round:rounds(name, display_order)").order("kickoff_at"),
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("rounds").select("id, name, stage, display_order").order("display_order"),
    supabase.from("groups").select("id, name").order("display_order"),
  ]);
  return <MatchesAdmin matches={matches ?? []} teams={teams ?? []} rounds={rounds ?? []} groups={groups ?? []} />;
}
