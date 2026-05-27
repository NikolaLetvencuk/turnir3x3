import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { belgradeLocalToUTCISO } from "@/lib/utils";
import { DailyTeamEditor, type PlayerForPicker, type PlayerStats } from "./DailyTeamEditor";

export const revalidate = 0;
export const dynamic = "force-dynamic";

function belgradeTodayKey(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function shiftDayUTC(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function belgradeDayRange(day: string) {
  const startUTC = belgradeLocalToUTCISO(`${day}T00:00`);
  const nextKey = shiftDayUTC(day, 1);
  const endUTC = belgradeLocalToUTCISO(`${nextKey}T00:00`);
  return { startUTC: startUTC ?? "", endUTC: endUTC ?? "" };
}

export default async function TeamPage({ searchParams }: { searchParams: { day?: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/team");

  const today = belgradeTodayKey();
  const tomorrow = shiftDayUTC(today, 1);
  const admin = createAdminClient();

  // ---- Determine the user's *editable* day --------------------------------
  // If today's first match hasn't started yet → today is editable.
  // If any of today's matches has left "scheduled" → editing moves to
  // tomorrow. Past days are always view-only.
  const todayRange = belgradeDayRange(today);
  const { data: todayMatchesRaw } = await admin
    .from("matches")
    .select("status")
    .gte("kickoff_at", todayRange.startUTC)
    .lt("kickoff_at", todayRange.endUTC);
  const todayMatches = (todayMatchesRaw ?? []) as Array<{ status: string }>;
  const todayStarted = todayMatches.some((m) => m.status && m.status !== "scheduled");
  const editableDay = todayStarted ? tomorrow : today;

  // ---- Resolve requested day, clamp to allowed range ----------------------
  let day = searchParams.day && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.day) ? searchParams.day : editableDay;
  // Don't allow navigating past the editable day — future beyond that is empty.
  if (day > editableDay) day = editableDay;

  const range = belgradeDayRange(day);

  const [
    playersRes,
    matchesRes,
    dayPickRes,
    latestPickRes,
    teamRes,
    daysWithPicksRes,
    eventsRes,
    finishedMatchesRes,
  ] = await Promise.all([
    admin
      .from("players")
      .select(
        "id, name, team_id, photo_url, team:teams!players_team_id_fkey(id, name, short_name, primary_color, secondary_color, logo_url)",
      )
      .order("name"),
    admin
      .from("matches")
      .select("id, status, bracket_position, kickoff_at, home_team_id, away_team_id")
      .gte("kickoff_at", range.startUTC)
      .lt("kickoff_at", range.endUTC)
      .order("kickoff_at"),
    (admin as any)
      .from("fantasy_day_picks")
      .select("*")
      .eq("user_id", profile.id)
      .eq("day", day)
      .maybeSingle(),
    (admin as any)
      .from("fantasy_day_picks")
      .select("*")
      .eq("user_id", profile.id)
      .lt("day", day)
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("fantasy_teams").select("name").eq("user_id", profile.id).maybeSingle(),
    (admin as any)
      .from("fantasy_day_picks")
      .select("day")
      .eq("user_id", profile.id)
      .order("day", { ascending: false }),
    admin.from("match_events").select("player_id, assist_player_id, event_type"),
    admin
      .from("matches")
      .select("status, home_team_id, away_team_id, home_score, away_score")
      .eq("status", "finished"),
  ]);

  const players = (playersRes.data ?? []) as PlayerForPicker[];
  const matches = (matchesRes.data ?? []) as Array<{
    id: string;
    status: string;
    bracket_position: string | null;
    kickoff_at: string | null;
    home_team_id: string | null;
    away_team_id: string | null;
  }>;
  const dayPick = (dayPickRes.data ?? null) as any;
  const fallbackPick = (latestPickRes.data ?? null) as any;
  const teamName = ((teamRes.data ?? null) as any)?.name ?? null;

  const isLockedForToday = matches.some((m) => m.status && m.status !== "scheduled");
  const isKnockoutPlus = matches.some(
    (m) => m.bracket_position && !m.bracket_position.startsWith("R16"),
  );

  const playingTeamIds = Array.from(
    new Set(
      matches.flatMap((m) => [m.home_team_id, m.away_team_id]).filter((id): id is string => !!id),
    ),
  );

  // Cumulative per-player stats for the picker info popup.
  const events = (eventsRes.data ?? []) as Array<{
    player_id: string | null;
    assist_player_id: string | null;
    event_type: string;
  }>;
  const stats = new Map<string, PlayerStats>();
  function bump(id: string, key: keyof PlayerStats) {
    const s = stats.get(id) ?? {
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      own_goals: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      clean_sheets: 0,
    };
    (s[key] as number)++;
    stats.set(id, s);
  }
  for (const e of events) {
    if (e.event_type === "goal" && e.player_id) bump(e.player_id, "goals");
    if (e.event_type === "goal" && e.assist_player_id) bump(e.assist_player_id, "assists");
    if (e.event_type === "yellow_card" && e.player_id) bump(e.player_id, "yellow_cards");
    if (e.event_type === "red_card" && e.player_id) bump(e.player_id, "red_cards");
    if (e.event_type === "own_goal" && e.player_id) bump(e.player_id, "own_goals");
  }
  // Team-level results aggregated and projected onto each player.
  const finishedMatches = (finishedMatchesRes.data ?? []) as Array<{
    status: string;
    home_team_id: string | null;
    away_team_id: string | null;
    home_score: number | null;
    away_score: number | null;
  }>;
  const teamAgg = new Map<string, { wins: number; draws: number; losses: number; clean_sheets: number }>();
  function teamBump(tid: string, key: "wins" | "draws" | "losses" | "clean_sheets") {
    const t = teamAgg.get(tid) ?? { wins: 0, draws: 0, losses: 0, clean_sheets: 0 };
    t[key]++;
    teamAgg.set(tid, t);
  }
  for (const m of finishedMatches) {
    if (!m.home_team_id || !m.away_team_id) continue;
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    if (hs > as) {
      teamBump(m.home_team_id, "wins");
      teamBump(m.away_team_id, "losses");
    } else if (as > hs) {
      teamBump(m.away_team_id, "wins");
      teamBump(m.home_team_id, "losses");
    } else {
      teamBump(m.home_team_id, "draws");
      teamBump(m.away_team_id, "draws");
    }
    if (as === 0) teamBump(m.home_team_id, "clean_sheets");
    if (hs === 0) teamBump(m.away_team_id, "clean_sheets");
  }
  for (const p of players) {
    if (!p.team_id) continue;
    const t = teamAgg.get(p.team_id);
    if (!t) continue;
    const s = stats.get(p.id) ?? {
      goals: 0,
      assists: 0,
      yellow_cards: 0,
      red_cards: 0,
      own_goals: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      clean_sheets: 0,
    };
    s.wins = t.wins;
    s.draws = t.draws;
    s.losses = t.losses;
    s.clean_sheets = t.clean_sheets;
    stats.set(p.id, s);
  }
  const statsObj: Record<string, PlayerStats> = {};
  stats.forEach((v, k) => {
    statsObj[k] = v;
  });

  // Days the user has saved a team for — used for the "Pogledaj prošli tim" list.
  const savedDays = ((daysWithPicksRes.data ?? []) as Array<{ day: string }>)
    .map((r) => r.day)
    .filter((d) => d < day);

  const initialPicks = dayPick
    ? { player1_id: dayPick.player1_id, player2_id: dayPick.player2_id, player3_id: dayPick.player3_id }
    : fallbackPick
    ? { player1_id: fallbackPick.player1_id, player2_id: fallbackPick.player2_id, player3_id: fallbackPick.player3_id }
    : null;

  return (
    <DailyTeamEditor
      day={day}
      today={today}
      editableDay={editableDay}
      teamName={teamName}
      players={players}
      isLockedForToday={isLockedForToday}
      isKnockoutPlus={isKnockoutPlus}
      playingTeamIds={playingTeamIds}
      initialPicks={initialPicks}
      isCurrentDayPick={!!dayPick}
      fallbackDay={!dayPick && fallbackPick ? (fallbackPick.day as string) : null}
      savedDays={savedDays}
      matchCount={matches.length}
      stats={statsObj}
    />
  );
}
