import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { rankWithTies } from "@/lib/fantasy";
import { LeagueDetail, type MemberRow } from "./LeagueDetail";

export const revalidate = 0;

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
  const memberRowsRaw = ((members ?? []) as Array<{ user_id: string; joined_at: string }>);
  const isMember = memberRowsRaw.some((m) => m.user_id === profile.id);
  if (!isMember && league.owner_id !== profile.id) notFound();

  const [{ data: rounds }, { data: roundPoints }, { data: teams }] = await Promise.all([
    admin.from("rounds").select("id, name, status, display_order, locked_at").order("display_order"),
    admin.from("fantasy_round_points").select("user_id, round_id, total_points"),
    admin.from("fantasy_teams").select("user_id, name"),
  ]);

  const roundList = (rounds ?? []) as Array<{ id: string; name: string; status: string; display_order: number; locked_at: string | null }>;
  const roundLockedAt = new Map<string, string | null>(roundList.map((r) => [r.id, r.locked_at]));
  const finishedRounds = roundList.filter((r) => r.status === "finished");
  const lastFinishedRoundId = finishedRounds.length > 0 ? finishedRounds[finishedRounds.length - 1].id : null;

  const teamNameByUser = new Map<string, string>();
  for (const t of ((teams ?? []) as Array<{ user_id: string; name: string | null }>)) {
    if (t.name && t.name.trim()) teamNameByUser.set(t.user_id, t.name);
  }

  // Per-member league total counts only rounds that locked AFTER the member joined.
  const allFRP = (roundPoints ?? []) as Array<{ user_id: string; round_id: string; total_points: number }>;
  function totalForMember(uid: string, joined_at: string): { total: number; lastRound: number | null } {
    let total = 0;
    let lastRound: number | null = null;
    for (const f of allFRP) {
      if (f.user_id !== uid) continue;
      const locked = roundLockedAt.get(f.round_id);
      if (!locked) continue;
      const countsForLeague = new Date(locked).getTime() > new Date(joined_at).getTime();
      if (!countsForLeague) continue;
      total += f.total_points ?? 0;
      if (lastFinishedRoundId && f.round_id === lastFinishedRoundId) {
        lastRound = f.total_points ?? 0;
      }
    }
    return { total, lastRound };
  }

  const rowsRaw = memberRowsRaw.map((m) => {
    const { total, lastRound } = totalForMember(m.user_id, m.joined_at);
    return {
      user_id: m.user_id,
      team_name: teamNameByUser.get(m.user_id) ?? "—",
      total,
      last_round: lastRound,
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
      lastRoundName={lastFinishedRoundId ? roundList.find((r) => r.id === lastFinishedRoundId)?.name ?? null : null}
    />
  );
}
