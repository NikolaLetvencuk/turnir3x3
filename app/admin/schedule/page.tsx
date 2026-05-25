import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
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
      <PageHeader
        icon={CalendarClock}
        title="Raspored"
        hint="Prevuci meč iz jednog kola u drugo da promeniš raspored. Zaključana kola su 🔒."
        tone="amber"
      />
      <div className="flex justify-end">
        <Link href="/admin/draw" className="text-sm text-blue-700 hover:underline">
          ← Novi žreb
        </Link>
      </div>
      <ScheduleBoard rounds={(rounds ?? []) as any[]} matches={(matches ?? []) as any[]} />
    </div>
  );
}
