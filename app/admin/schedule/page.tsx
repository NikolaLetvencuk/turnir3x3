import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScheduleBoard } from "./ScheduleBoard";

export const revalidate = 0;

export default async function SchedulePage() {
  const supabase = createClient();
  const [{ data: rounds }, { data: matches }] = await Promise.all([
    supabase.from("rounds").select("id, name, status, display_order, stage").order("display_order"),
    supabase
      .from("matches")
      .select("id, round_id, home_team_id, away_team_id, status, phase, kickoff_at, home:teams!matches_home_team_id_fkey(id,name,short_name,primary_color,secondary_color), away:teams!matches_away_team_id_fkey(id,name,short_name,primary_color,secondary_color)")
      .order("kickoff_at"),
  ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Raspored po kolima</h1>
        <Link href="/admin/draw" className="text-sm text-emerald-700 hover:underline">Novi žreb →</Link>
      </div>
      <p className="text-sm text-zinc-600">Prevuci meč iz jednog kola u drugo da bi promenio raspored. Zaključana kola su označena katancem.</p>
      <ScheduleBoard rounds={(rounds ?? []) as any[]} matches={(matches ?? []) as any[]} />
    </div>
  );
}
