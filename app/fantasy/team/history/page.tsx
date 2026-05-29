import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { HistoryView, type DayEntry } from "./HistoryView";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function belgradeKeyOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export default async function HistoryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/team/history");

  const admin = createAdminClient();
  const [{ data: picks }, { data: pts }, { data: players }, { data: events }, { data: matches }] =
    await Promise.all([
      (admin as any)
        .from("fantasy_day_picks")
        .select("day, player1_id, player2_id, player3_id")
        .eq("user_id", profile.id)
        .order("day", { ascending: false }),
      (admin as any)
        .from("fantasy_day_points")
        .select("day, player1_points, player2_points, player3_points, total_points")
        .eq("user_id", profile.id),
      admin
        .from("players")
        .select("id, name, photo_url, team_id, team:teams(id, name, short_name, primary_color, secondary_color, logo_url)"),
      admin.from("match_events").select("match_id, player_id, assist_player_id, event_type"),
      admin
        .from("matches")
        .select("id, status, home_team_id, away_team_id, home_score, away_score, kickoff_at")
        .eq("status", "finished"),
    ]);

  const playerMap = new Map(((players ?? []) as any[]).map((p) => [p.id, p]));
  const ptsMap = new Map<string, any>();
  for (const r of (pts ?? []) as any[]) ptsMap.set(r.day, r);

  const allMatches = (matches ?? []) as Array<{
    id: string;
    status: string;
    home_team_id: string | null;
    away_team_id: string | null;
    home_score: number | null;
    away_score: number | null;
    kickoff_at: string | null;
  }>;
  const allEvents = (events ?? []) as Array<{
    match_id: string;
    player_id: string | null;
    assist_player_id: string | null;
    event_type: string;
  }>;

  // Index matches by Belgrade day, and events by match.
  const matchDay = new Map<string, string>(); // match_id -> day
  const matchesByDay = new Map<string, typeof allMatches>();
  for (const m of allMatches) {
    if (!m.kickoff_at) continue;
    const k = belgradeKeyOf(m.kickoff_at);
    matchDay.set(m.id, k);
    const arr = matchesByDay.get(k) ?? [];
    arr.push(m);
    matchesByDay.set(k, arr);
  }
  const eventsByMatch = new Map<string, typeof allEvents>();
  for (const e of allEvents) {
    const arr = eventsByMatch.get(e.match_id) ?? [];
    arr.push(e);
    eventsByMatch.set(e.match_id, arr);
  }

  // Compute a player's breakdown + points for one day.
  function playerDay(playerId: string, day: string) {
    const p = playerMap.get(playerId);
    const teamId = p?.team_id ?? null;
    const dayMatches = matchesByDay.get(day) ?? [];
    let goals = 0, assists = 0, yellow = 0, red = 0, own = 0;
    let won = false, drew = false, clean = false, played = false;
    for (const m of dayMatches) {
      const isTeamMatch = teamId && (m.home_team_id === teamId || m.away_team_id === teamId);
      if (isTeamMatch) {
        played = true;
        const isHome = m.home_team_id === teamId;
        const our = isHome ? m.home_score ?? 0 : m.away_score ?? 0;
        const their = isHome ? m.away_score ?? 0 : m.home_score ?? 0;
        if (our > their) won = true;
        else if (our === their) drew = true;
        if (their === 0) clean = true;
      }
      for (const e of eventsByMatch.get(m.id) ?? []) {
        if (e.event_type === "goal" && e.player_id === playerId) goals++;
        if (e.event_type === "goal" && e.assist_player_id === playerId) assists++;
        if (e.event_type === "yellow_card" && e.player_id === playerId) yellow++;
        if (e.event_type === "red_card" && e.player_id === playerId) red++;
        if (e.event_type === "own_goal" && e.player_id === playerId) own++;
      }
    }
    const points =
      goals * 3 + assists * 2 + (won ? 1 : 0) + (clean ? 1 : 0) - yellow - red * 2 - own;
    return {
      id: playerId,
      name: p?.name ?? "?",
      photo_url: p?.photo_url ?? null,
      team_short: p?.team?.short_name ?? null,
      team_name: p?.team?.name ?? null,
      team_primary: p?.team?.primary_color ?? null,
      played,
      goals,
      assists,
      yellow,
      red,
      own,
      won,
      drew,
      clean,
      points,
    };
  }

  const rows = (picks ?? []) as Array<{
    day: string;
    player1_id: string;
    player2_id: string;
    player3_id: string;
  }>;
  const days: DayEntry[] = rows.map((r) => {
    const slots = [r.player1_id, r.player2_id, r.player3_id].map((pid) => playerDay(pid, r.day));
    const stored = ptsMap.get(r.day);
    const total = stored ? stored.total_points : slots.reduce((a, s) => a + s.points, 0);
    return { day: r.day, slots, total };
  });

  const grandTotal = days.reduce((a, d) => a + d.total, 0);

  return <HistoryView days={days} grandTotal={grandTotal} />;
}
