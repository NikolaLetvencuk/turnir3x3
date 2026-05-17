import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { LeagueDetail, type MemberRow, type RoundLite } from "./LeagueDetail";

export const revalidate = 0;

export default async function LeagueDetailPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login?next=/fantasy/leagues");
  const supabase = createClient();
  const { data: leagueData } = await supabase.from("fantasy_leagues").select("*").eq("id", params.id).maybeSingle();
  if (!leagueData) notFound();
  const league = leagueData as { id: string; name: string; invite_code: string; owner_id: string };

  const { data: membership } = await supabase
    .from("fantasy_league_members")
    .select("user_id")
    .eq("league_id", params.id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!membership && league.owner_id !== profile.id) notFound();

  const admin = createAdminClient();
  const [{ data: members }, { data: rounds }, { data: roundPoints }] = await Promise.all([
    admin.from("fantasy_league_members").select("user_id").eq("league_id", params.id),
    admin.from("rounds").select("id, name, status, display_order").order("display_order"),
    admin.from("fantasy_round_points").select("user_id, round_id, total_points"),
  ]);

  const memberIds = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
  const { data: usersRes } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(usersRes.users.map((u) => [u.id, u.email ?? ""]));

  const totalsByUser = new Map<string, number>();
  for (const r of ((roundPoints ?? []) as Array<{ user_id: string; round_id: string; total_points: number }>)) {
    totalsByUser.set(r.user_id, (totalsByUser.get(r.user_id) ?? 0) + (r.total_points ?? 0));
  }
  const rowsByUser = new Map<string, Record<string, number>>();
  for (const r of ((roundPoints ?? []) as Array<{ user_id: string; round_id: string; total_points: number }>)) {
    if (!rowsByUser.has(r.user_id)) rowsByUser.set(r.user_id, {});
    rowsByUser.get(r.user_id)![r.round_id] = r.total_points ?? 0;
  }

  const memberRows: MemberRow[] = memberIds
    .map((uid) => ({
      user_id: uid,
      email: emailById.get(uid) ?? "—",
      display: (emailById.get(uid) ?? "—").split("@")[0],
      total: totalsByUser.get(uid) ?? 0,
      per_round: rowsByUser.get(uid) ?? {},
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <LeagueDetail
      leagueName={league.name}
      inviteCode={league.invite_code}
      rounds={(rounds ?? []) as RoundLite[]}
      members={memberRows}
      currentUserId={profile.id}
    />
  );
}
