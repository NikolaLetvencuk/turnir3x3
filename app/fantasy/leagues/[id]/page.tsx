import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
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
    .select("user_id")
    .eq("league_id", params.id);
  const memberIds = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
  const isMember = memberIds.includes(profile.id);
  if (!isMember && league.owner_id !== profile.id) notFound();

  const [{ data: rounds }, { data: roundPoints }, { data: teams }] = await Promise.all([
    admin.from("rounds").select("id, name, status, display_order").order("display_order"),
    admin.from("fantasy_round_points").select("user_id, round_id, total_points"),
    admin.from("fantasy_teams").select("user_id, name"),
  ]);

  // last finished round (or null if none)
  const finishedRounds = ((rounds ?? []) as Array<{ id: string; status: string; display_order: number }>)
    .filter((r) => r.status === "finished");
  const lastFinishedRoundId = finishedRounds.length > 0 ? finishedRounds[finishedRounds.length - 1].id : null;

  const totalsByUser = new Map<string, number>();
  const lastRoundByUser = new Map<string, number>();
  for (const r of ((roundPoints ?? []) as Array<{ user_id: string; round_id: string; total_points: number }>)) {
    totalsByUser.set(r.user_id, (totalsByUser.get(r.user_id) ?? 0) + (r.total_points ?? 0));
    if (lastFinishedRoundId && r.round_id === lastFinishedRoundId) {
      lastRoundByUser.set(r.user_id, r.total_points ?? 0);
    }
  }

  const teamNameByUser = new Map<string, string>();
  for (const t of ((teams ?? []) as Array<{ user_id: string; name: string | null }>)) {
    if (t.name && t.name.trim()) teamNameByUser.set(t.user_id, t.name);
  }

  const memberRows: MemberRow[] = memberIds
    .map((uid) => ({
      user_id: uid,
      team_name: teamNameByUser.get(uid) ?? "—",
      total: totalsByUser.get(uid) ?? 0,
      last_round: lastFinishedRoundId ? (lastRoundByUser.get(uid) ?? 0) : null,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <LeagueDetail
      leagueName={league.name}
      inviteCode={league.invite_code}
      members={memberRows}
      currentUserId={profile.id}
      lastRoundName={lastFinishedRoundId ? ((rounds ?? []) as any[]).find((r) => r.id === lastFinishedRoundId)?.name ?? null : null}
    />
  );
}
