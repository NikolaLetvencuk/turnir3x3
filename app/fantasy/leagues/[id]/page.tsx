import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { LeagueGrid } from "./LeagueGrid";

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

  // Use service-role to assemble grid (members + their snapshots + points)
  const admin = createAdminClient();
  const [{ data: members }, { data: rounds }, { data: snapshots }, { data: roundPoints }, { data: playerPoints }, { data: players }] = await Promise.all([
    admin.from("fantasy_league_members").select("user_id").eq("league_id", params.id),
    admin.from("rounds").select("id, name, display_order, status").order("display_order"),
    admin.from("fantasy_team_snapshots").select("*"),
    admin.from("fantasy_round_points").select("*"),
    admin.from("fantasy_player_points").select("*"),
    admin.from("players").select("id, name"),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: usersRes } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const userEmailById = new Map(usersRes.users.map((u) => [u.id, u.email ?? ""]));

  const playerMap = new Map((players ?? []).map((p) => [p.id, p.name]));
  const ppMap = new Map<string, any>();
  for (const p of (playerPoints ?? [])) ppMap.set(`${p.player_id}_${p.round_id}`, p);
  const snapMap = new Map<string, any>();
  for (const s of (snapshots ?? [])) snapMap.set(`${s.user_id}_${s.round_id}`, s);
  const rpMap = new Map<string, any>();
  for (const r of (roundPoints ?? [])) rpMap.set(`${r.user_id}_${r.round_id}`, r);

  const memberRows = memberIds.map((uid) => {
    const cells = (rounds ?? []).map((r) => ({
      round_id: r.id,
      points: rpMap.get(`${uid}_${r.id}`)?.total_points ?? null,
    }));
    const total = cells.reduce((a, b) => a + (b.points ?? 0), 0);
    return { user_id: uid, email: userEmailById.get(uid) ?? "—", cells, total };
  });
  memberRows.sort((a, b) => b.total - a.total);

  // Modal data: precompute per (user, round) breakdown
  const breakdown = new Map<string, any>();
  for (const uid of memberIds) {
    for (const r of (rounds ?? [])) {
      const snap = snapMap.get(`${uid}_${r.id}`);
      const rp = rpMap.get(`${uid}_${r.id}`);
      if (!snap && !rp) continue;
      breakdown.set(`${uid}_${r.id}`, {
        snap, rp,
        names: snap ? {
          p1: snap.player1_id ? playerMap.get(snap.player1_id) : null,
          p2: snap.player2_id ? playerMap.get(snap.player2_id) : null,
          p3: snap.player3_id ? playerMap.get(snap.player3_id) : null,
        } : null,
        playerPoints: snap ? {
          p1: snap.player1_id ? ppMap.get(`${snap.player1_id}_${r.id}`) : null,
          p2: snap.player2_id ? ppMap.get(`${snap.player2_id}_${r.id}`) : null,
          p3: snap.player3_id ? ppMap.get(`${snap.player3_id}_${r.id}`) : null,
        } : null,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{league.name}</h1>
        <p className="text-xs text-zinc-500">Kod: <span className="font-mono">{league.invite_code}</span></p>
      </div>
      <LeagueGrid
        rounds={(rounds ?? []).map((r) => ({ id: r.id, name: r.name }))}
        rows={memberRows}
        breakdown={Object.fromEntries(breakdown)}
      />
    </div>
  );
}
