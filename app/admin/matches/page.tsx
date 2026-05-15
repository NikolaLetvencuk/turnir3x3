import { createClient } from "@/lib/supabase/server";
import { MatchesAdmin } from "./MatchesAdmin";

export const revalidate = 0;

export default async function MatchesAdminPage() {
  const supabase = createClient();
  const { data: matches } = await supabase
    .from("matches")
    .select("*, home:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color), away:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color), round:rounds(name, display_order)")
    .order("kickoff_at");
  return <MatchesAdmin matches={(matches ?? []) as any[]} />;
}
