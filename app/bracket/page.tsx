import { createClient } from "@/lib/supabase/server";
import { BracketTree } from "@/components/bracket/BracketTree";
import { BracketRealtime } from "./BracketRealtime";

export const revalidate = 0;

export default async function BracketPage() {
  const supabase = createClient();
  const [{ data: rounds }, { data: matches }, { data: teams }] = await Promise.all([
    supabase.from("rounds").select("id, name, display_order").eq("stage", "knockout").order("display_order"),
    supabase
      .from("matches")
      .select("id, round_id, bracket_position, home_team_id, away_team_id, home_placeholder, away_placeholder, home_team_id_manual, away_team_id_manual, home_score, away_score, phase, kickoff_at, knockout_winner_id, home_team:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url), away_team:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color,logo_url)")
      .not("bracket_position", "is", null)
      .order("kickoff_at"),
    supabase.from("teams").select("id, name, short_name, primary_color, secondary_color, logo_url"),
  ]);

  const ko = (matches ?? []) as any[];

  return (
    <>
      <BracketRealtime />
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Eliminaciona faza</h1>
        {ko.length === 0 ? (
          <p className="text-sm text-zinc-500">Eliminaciona faza još nije objavljena.</p>
        ) : (
          <BracketTree rounds={(rounds ?? []) as any[]} matches={ko} teams={(teams ?? []) as any[]} />
        )}
      </div>
    </>
  );
}
