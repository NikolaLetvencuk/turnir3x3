import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { rankWithTies } from "@/lib/fantasy";
import { LeagueDetail, type MemberRow } from "./LeagueDetail";

export const revalidate = 0;

function belgradeDateKey(iso: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(iso));
}

export default async function LeagueDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/leagues");

  const admin = createAdminClient();
  const { data: leagueData } = await admin
    .from("fantasy_leagues")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!leagueData) notFound();
  const league = leagueData as { id: string; name: string; invite_code: string; owner_id: string };

  const { data: members } = await admin
    .from("fantasy_league_members")
    .select("user_id, joined_at")
    .eq("league_id", params.id);
  const memberRowsRaw = (members ?? []) as Array<{ user_id: string; joined_at: string }>;
  const isMember = memberRowsRaw.some((m) => m.user_id === profile.id);
  if (!isMember && league.owner_id !== profile.id) notFound();

  const [{ data: dayPoints }, { data: teams }] = await Promise.all([
    (admin as any).from("fantasy_day_points").select("user_id, day, total_points").order("day"),
    admin.from("fantasy_teams").select("user_id, name"),
  ]);

  const teamNameByUser = new Map<string, string>();
  for (const t of (teams ?? []) as Array<{ user_id: string; name: string | null }>) {
    if (t.name && t.name.trim()) teamNameByUser.set(t.user_id, t.name);
  }

  // Per-member league total counts only days that started on or after the
  // member's join date (Belgrade). Last-day points = the most recent day in
  // the set.
  const allDP = (dayPoints ?? []) as Array<{ user_id: string; day: string; total_points: number }>;
  const sortedDays = Array.from(new Set(allDP.map((d) => d.day))).sort();
  const lastDay = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1] : null;

  function totalForMember(uid: string, joined_at: string): { total: number; lastDay: number | null } {
    const joinedDay = belgradeDateKey(joined_at);
    let total = 0;
    let last: number | null = null;
    for (const f of allDP) {
      if (f.user_id !== uid) continue;
      if (f.day < joinedDay) continue;
      total += f.total_points ?? 0;
      if (lastDay && f.day === lastDay) last = f.total_points ?? 0;
    }
    return { total, lastDay: last };
  }

  const rowsRaw = memberRowsRaw.map((m) => {
    const { total, lastDay } = totalForMember(m.user_id, m.joined_at);
    return {
      user_id: m.user_id,
      team_name: teamNameByUser.get(m.user_id) ?? "—",
      total,
      last_round: lastDay,
    };
  });
  const ranked = rankWithTies(rowsRaw);
  const memberRows: MemberRow[] = ranked.map((r) => ({
    user_id: r.user_id,
    team_name: r.team_name,
    total: r.total,
    last_round: r.last_round,
    rank: r.rank,
  }));

  return (
    <LeagueDetail
      leagueName={league.name}
      inviteCode={league.invite_code}
      members={memberRows}
      currentUserId={profile.id}
      lastRoundName={lastDay ? formatSrDate(lastDay) : null}
    />
  );
}

const SR_MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
function formatSrDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d}. ${SR_MONTHS[m - 1] ?? m}.`;
}
