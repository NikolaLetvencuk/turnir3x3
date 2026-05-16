import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LiveMatchView } from "./LiveMatchView";

export const revalidate = 0;

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: match }, { data: events }, { data: players }] = await Promise.all([
    supabase
      .from("matches")
      .select("*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*), round:rounds(name, stage)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("match_events")
      .select("*")
      .eq("match_id", params.id)
      .order("minute", { ascending: true, nullsFirst: true })
      .order("created_at"),
    supabase.from("players").select("id, name, team_id, photo_url"),
  ]);

  if (!match) notFound();

  const m = match as any;
  // For pre-match view: fetch group standings + group teams if this is a group match
  let groupStandings: any[] = [];
  let groupTeamsWithMeta: Array<{ id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null }> = [];
  if (m.group_id) {
    const [{ data: sview }, { data: gtTeams }] = await Promise.all([
      supabase.from("standings").select("*").eq("group_id", m.group_id),
      supabase
        .from("group_teams")
        .select("team_id, team:teams(id, name, short_name, primary_color, secondary_color)")
        .eq("group_id", m.group_id),
    ]);
    const sv = (sview ?? []) as any[];
    const teamsLite = ((gtTeams ?? []) as any[]).map((x) => x.team).filter(Boolean);
    groupTeamsWithMeta = teamsLite;
    const standingsByTeam = new Map(sv.map((r) => [r.team_id, r]));
    groupStandings = teamsLite
      .map((t: any) => {
        const s = standingsByTeam.get(t.id);
        return {
          team: t,
          played: s?.played ?? 0,
          wins: s?.wins ?? 0,
          draws: s?.draws ?? 0,
          losses: s?.losses ?? 0,
          goals_for: s?.goals_for ?? 0,
          goals_against: s?.goals_against ?? 0,
          goal_diff: s?.goal_diff ?? 0,
          points: s?.points ?? 0,
        };
      })
      .sort((a: any, b: any) =>
        b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for || a.team.name.localeCompare(b.team.name),
      );
  }

  return (
    <LiveMatchView
      matchInit={match as any}
      eventsInit={events ?? []}
      players={players ?? []}
      groupStandings={groupStandings}
    />
  );
}
