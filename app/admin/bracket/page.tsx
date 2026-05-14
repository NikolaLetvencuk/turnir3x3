import { createClient } from "@/lib/supabase/server";
import { BracketAdmin } from "./BracketAdmin";

export const revalidate = 0;

export default async function BracketAdminPage() {
  const supabase = createClient();
  const [{ data: rounds }, { data: teams }, { data: matches }] = await Promise.all([
    supabase.from("rounds").select("id, name, stage").eq("stage", "knockout").order("display_order"),
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("matches").select("*, home:teams!matches_home_team_id_fkey(name), away:teams!matches_away_team_id_fkey(name), round:rounds(name)").order("kickoff_at"),
  ]);
  const knockoutMatches = (matches ?? []).filter((m: any) => (rounds ?? []).some((r: any) => r.id === m.round_id));
  return <BracketAdmin rounds={rounds ?? []} teams={teams ?? []} matches={knockoutMatches} />;
}
