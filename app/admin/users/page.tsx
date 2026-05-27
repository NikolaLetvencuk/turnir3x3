import { createAdminClient } from "@/lib/supabase/admin";
import { UsersAdmin } from "./UsersAdmin";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = createAdminClient();

  const [{ data: profiles }, { data: fantasyTeams }, { data: dayPoints }, { data: players }] =
    await Promise.all([
      admin.from("profiles").select("id, email, role, created_at").order("created_at", { ascending: false }),
      admin.from("fantasy_teams").select("user_id, name, player1_id, player2_id, player3_id, updated_at"),
      (admin as any).from("fantasy_day_points").select("user_id, day, total_points"),
      admin.from("players").select("id, name"),
    ]);

  const playersById = new Map<string, string>(((players ?? []) as any[]).map((p) => [p.id, p.name]));
  const teamByUser = new Map<string, any>(((fantasyTeams ?? []) as any[]).map((t) => [t.user_id, t]));

  // Sum points per user across every day they have an entry for. "rounds" in
  // the row name is kept for the existing UI but now represents days played.
  const pointsByUser = new Map<string, { total: number; rounds: number }>();
  for (const row of (dayPoints ?? []) as any[]) {
    const cur = pointsByUser.get(row.user_id) ?? { total: 0, rounds: 0 };
    cur.total += row.total_points ?? 0;
    cur.rounds += 1;
    pointsByUser.set(row.user_id, cur);
  }

  const rows = ((profiles ?? []) as any[]).map((p) => {
    const team = teamByUser.get(p.id);
    const pts = pointsByUser.get(p.id);
    return {
      user_id: p.id,
      email: p.email as string,
      role: p.role as string,
      created_at: p.created_at as string,
      team_name: team?.name ?? null,
      players: team
        ? [team.player1_id, team.player2_id, team.player3_id]
            .map((pid) => (pid ? playersById.get(pid) ?? "?" : null))
            .filter(Boolean) as string[]
        : [],
      total_points: pts?.total ?? 0,
      rounds_played: pts?.rounds ?? 0,
      has_team: !!team,
    };
  });

  return <UsersAdmin rows={rows} />;
}
