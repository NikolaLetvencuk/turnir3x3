import { createClient } from "@/lib/supabase/server";
import { MatchesAdmin } from "./MatchesAdmin";

export const revalidate = 0;

export default async function MatchesAdminPage() {
  const supabase = createClient();
  const [{ data: matches }, { data: rounds }] = await Promise.all([
    supabase
      .from("matches")
      .select("*, home:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color), away:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color), round:rounds(id,name,display_order,stage,status)")
      .order("kickoff_at"),
    supabase.from("rounds").select("id, name, status, display_order, stage").order("display_order"),
  ]);
  return <MatchesAdmin matches={(matches ?? []) as any[]} rounds={(rounds ?? []) as any[]} />;
}
