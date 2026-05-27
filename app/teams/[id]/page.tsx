import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { TeamDetail, type TeamMatchRow } from "./TeamDetail";

export const revalidate = 0;

export default async function TeamPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: team }, { data: players }, { data: matches }] = await Promise.all([
    supabase.from("teams").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("players").select("id, name, team_id, photo_url").eq("team_id", params.id),
    supabase
      .from("matches")
      .select("id, round_id, home_team_id, away_team_id, home_score, away_score, phase, kickoff_at, finished_at, knockout_winner_id, home_team:teams!matches_home_team_id_fkey(id, name, short_name, primary_color, secondary_color, logo_url), away_team:teams!matches_away_team_id_fkey(id, name, short_name, primary_color, secondary_color, logo_url), round:rounds(id, name, stage, display_order)")
      .or(`home_team_id.eq.${params.id},away_team_id.eq.${params.id}`)
      .order("kickoff_at", { ascending: true, nullsFirst: false }),
  ]);

  if (!team) notFound();

  const playerList = (players ?? []) as Array<{ id: string; name: string; team_id: string | null; photo_url: string | null }>;
  const playerIds = playerList.map((p) => p.id);
  const playerStats = new Map<string, { goals: number; assists: number; yellows: number; reds: number; own_goals: number }>();
  for (const p of playerList) playerStats.set(p.id, { goals: 0, assists: 0, yellows: 0, reds: 0, own_goals: 0 });

  if (playerIds.length > 0) {
    const inList = `(${playerIds.join(",")})`;
    const { data: ev } = await supabase
      .from("match_events")
      .select("player_id, assist_player_id, event_type")
      .or(`player_id.in.${inList},assist_player_id.in.${inList}`);
    for (const e of ((ev ?? []) as any[])) {
      if (e.player_id && playerStats.has(e.player_id)) {
        const s = playerStats.get(e.player_id)!;
        if (e.event_type === "goal") s.goals++;
        else if (e.event_type === "yellow_card") s.yellows++;
        else if (e.event_type === "red_card") s.reds++;
        else if (e.event_type === "own_goal") s.own_goals++;
      }
      if (e.assist_player_id && playerStats.has(e.assist_player_id) && e.event_type === "goal") {
        playerStats.get(e.assist_player_id)!.assists++;
      }
    }
  }

  return (
    <TeamDetail
      team={team as any}
      players={playerList.map((p) => ({ ...p, stats: playerStats.get(p.id)! }))}
      matches={(matches ?? []) as unknown as TeamMatchRow[]}
    />
  );
}
