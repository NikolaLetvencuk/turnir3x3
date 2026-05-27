import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { belgradeLocalToUTCISO } from "@/lib/utils";
import { DailyTeamEditor, type PlayerForPicker } from "./DailyTeamEditor";

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
  const day = searchParams.day && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.day) ? searchParams.day : today;

  const admin = createAdminClient();
  const range = belgradeDayRange(day);

  const [playersRes, matchesRes, dayPickRes, latestPickRes, teamRes, daysWithMatchesRes] = await Promise.all([
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
    admin.from("matches").select("kickoff_at").not("kickoff_at", "is", null),
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

  const isLocked = matches.some((m) => m.status && m.status !== "scheduled");
  const isKnockoutPlus = matches.some(
    (m) => m.bracket_position && !m.bracket_position.startsWith("R16"),
  );

  const playingTeamIds = Array.from(
    new Set(
      matches.flatMap((m) => [m.home_team_id, m.away_team_id]).filter((id): id is string => !!id),
    ),
  );

  // Unique Belgrade dates that have any scheduled match — used to populate the
  // date jumper so the admin can quickly hop between active tournament days.
  const daysSet = new Set<string>();
  for (const r of (daysWithMatchesRes.data ?? []) as Array<{ kickoff_at: string | null }>) {
    if (!r.kickoff_at) continue;
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Belgrade",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    daysSet.add(fmt.format(new Date(r.kickoff_at)));
  }
  const tournamentDays = Array.from(daysSet).sort();

  const initialPicks = dayPick
    ? { player1_id: dayPick.player1_id, player2_id: dayPick.player2_id, player3_id: dayPick.player3_id }
    : fallbackPick
    ? { player1_id: fallbackPick.player1_id, player2_id: fallbackPick.player2_id, player3_id: fallbackPick.player3_id }
    : null;

  return (
    <DailyTeamEditor
      day={day}
      today={today}
      teamName={teamName}
      players={players}
      isLocked={isLocked}
      isKnockoutPlus={isKnockoutPlus}
      playingTeamIds={playingTeamIds}
      initialPicks={initialPicks}
      isCurrentDayPick={!!dayPick}
      fallbackDay={!dayPick && fallbackPick ? (fallbackPick.day as string) : null}
      tournamentDays={tournamentDays}
      matchCount={matches.length}
    />
  );
}
