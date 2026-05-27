import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { LiveMatchView, type FormEntry, type StandingRow } from "./LiveMatchView";

export const revalidate = 0;

type TeamLite = { id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null; logo_url?: string | null };

type FinishedMatchRow = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number;
  away_score: number;
  knockout_winner_id: string | null;
  finished_at: string | null;
  home_team: TeamLite | null;
  away_team: TeamLite | null;
};

function resultForTeam(m: FinishedMatchRow, teamId: string): "W" | "L" | "D" {
  if (m.knockout_winner_id) {
    return m.knockout_winner_id === teamId ? "W" : "L";
  }
  const isHome = m.home_team_id === teamId;
  const us = isHome ? m.home_score : m.away_score;
  const them = isHome ? m.away_score : m.home_score;
  if (us > them) return "W";
  if (us < them) return "L";
  return "D";
}

function buildForm(rows: FinishedMatchRow[], teamId: string, excludeMatchId: string): FormEntry[] {
  return rows
    .filter((m) => m.id !== excludeMatchId)
    .filter((m) => m.home_team_id === teamId || m.away_team_id === teamId)
    .sort((a, b) => (b.finished_at ?? "").localeCompare(a.finished_at ?? ""))
    .slice(0, 3)
    .map((m) => {
      const isHome = m.home_team_id === teamId;
      const opponent = isHome ? m.away_team : m.home_team;
      return {
        result: resultForTeam(m, teamId),
        opponent: opponent,
        score: `${isHome ? m.home_score : m.away_score} : ${isHome ? m.away_score : m.home_score}`,
        match_id: m.id,
      };
    });
}

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

  // Group standings if this match is part of a group
  let groupStandings: StandingRow[] = [];
  if (m.group_id) {
    const [{ data: sview }, { data: gtTeams }] = await Promise.all([
      supabase.from("standings").select("*").eq("group_id", m.group_id),
      supabase
        .from("group_teams")
        .select("team_id, team:teams(id, name, short_name, primary_color, secondary_color, logo_url)")
        .eq("group_id", m.group_id),
    ]);
    const sv = (sview ?? []) as any[];
    const teamsLite = ((gtTeams ?? []) as any[]).map((x) => x.team).filter(Boolean);
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

  // Form: last 3 finished matches for each team (excluding this one)
  let formHome: FormEntry[] = [];
  let formAway: FormEntry[] = [];
  if (m.home_team_id || m.away_team_id) {
    const teamIds = [m.home_team_id, m.away_team_id].filter(Boolean) as string[];
    const { data: finished } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, home_score, away_score, knockout_winner_id, finished_at, home_team:teams!matches_home_team_id_fkey(id, name, short_name, primary_color, secondary_color, logo_url), away_team:teams!matches_away_team_id_fkey(id, name, short_name, primary_color, secondary_color, logo_url)")
      .eq("phase", "finished")
      .or(teamIds.map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(","));
    const rows = (finished ?? []) as unknown as FinishedMatchRow[];
    if (m.home_team_id) formHome = buildForm(rows, m.home_team_id, m.id);
    if (m.away_team_id) formAway = buildForm(rows, m.away_team_id, m.id);
  }

  return (
    <LiveMatchView
      matchInit={match as any}
      eventsInit={events ?? []}
      players={players ?? []}
      groupStandings={groupStandings}
      formHome={formHome}
      formAway={formAway}
    />
  );
}
