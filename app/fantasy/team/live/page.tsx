import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { LiveTeamView, type RoundLite, type PlayerSlot } from "./LiveTeamView";

export const revalidate = 0;

export default async function LiveTeamPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/team/live");

  const admin = createAdminClient();
  const [{ data: rounds }, { data: snaps }, { data: players }, { data: teams }, { data: ppRows }, { data: frpRows }] = await Promise.all([
    admin.from("rounds").select("id, name, status, display_order").order("display_order"),
    admin.from("fantasy_team_snapshots").select("round_id, player1_id, player2_id, player3_id, bank").eq("user_id", profile.id),
    admin.from("players").select("id, name, photo_url, team_id"),
    admin.from("teams").select("id, name, primary_color"),
    admin.from("fantasy_player_points").select("player_id, round_id, goals, assists, yellow_cards, red_cards, own_goals, wins, draws, losses, clean_sheets, total_points"),
    admin.from("fantasy_round_points").select("round_id, total_points").eq("user_id", profile.id),
  ]);

  const roundList = (rounds ?? []) as RoundLite[];
  // Focus: active round if any, else next upcoming, else last finished
  const active = roundList.find((r) => r.status === "active");
  const upcoming = roundList.find((r) => r.status === "upcoming");
  const finishedList = roundList.filter((r) => r.status === "finished");
  const finished = finishedList[finishedList.length - 1] ?? null;
  const focusRound = active ?? upcoming ?? finished ?? null;

  const playerMap = new Map(((players ?? []) as any[]).map((p) => [p.id, p]));
  const teamMap = new Map(((teams ?? []) as any[]).map((t) => [t.id, t]));
  const ppMap = new Map<string, any>();
  for (const r of ((ppRows ?? []) as any[])) ppMap.set(`${r.player_id}_${r.round_id}`, r);
  const frpMap = new Map<string, number>();
  for (const r of ((frpRows ?? []) as Array<{ round_id: string; total_points: number }>)) frpMap.set(r.round_id, r.total_points);

  const snap = focusRound ? ((snaps ?? []) as any[]).find((s) => s.round_id === focusRound.id) : null;
  const slots: PlayerSlot[] = snap
    ? ([snap.player1_id, snap.player2_id, snap.player3_id] as (string | null)[]).map((pid) => {
        if (!pid) return null;
        const p = playerMap.get(pid);
        const team = p?.team_id ? teamMap.get(p.team_id) : null;
        const pp = focusRound ? ppMap.get(`${pid}_${focusRound.id}`) : null;
        return {
          id: pid,
          name: p?.name ?? "?",
          photo_url: p?.photo_url ?? null,
          team_name: team?.name ?? null,
          team_primary: team?.primary_color ?? null,
          breakdown: pp ? {
            goals: pp.goals, assists: pp.assists,
            wins: pp.wins, draws: pp.draws, losses: pp.losses ?? 0,
            clean_sheets: pp.clean_sheets,
            yellow_cards: pp.yellow_cards, red_cards: pp.red_cards, own_goals: pp.own_goals,
          } : null,
          points: pp?.total_points ?? 0,
        };
      })
    : [null, null, null];

  const total = focusRound ? frpMap.get(focusRound.id) ?? slots.reduce((acc, s) => acc + (s?.points ?? 0), 0) : 0;

  return (
    <div className="space-y-4">
      <Link href="/fantasy" className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-emerald-700">
        <ArrowLeft className="w-4 h-4" /> Nazad na Fantasy
      </Link>
      <LiveTeamView round={focusRound} slots={slots} total={total} bank={snap?.bank ?? null} />
    </div>
  );
}
