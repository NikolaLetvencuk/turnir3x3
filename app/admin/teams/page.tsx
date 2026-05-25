import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamsAdmin } from "./TeamsAdmin";

export const revalidate = 0;

export default async function TeamsAdminPage() {
  const supabase = createClient();
  const admin = createAdminClient();
  const [{ data: teams }, { data: captains }, { data: players }] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    admin.from("team_captains").select("team_id, name, phone"),
    supabase.from("players").select("id, name, team_id").order("name"),
  ]);
  const captainMap = new Map<string, { name: string | null; phone: string | null }>();
  for (const c of (captains ?? []) as Array<{ team_id: string; name: string | null; phone: string | null }>) {
    captainMap.set(c.team_id, { name: c.name, phone: c.phone });
  }
  const playersByTeam = new Map<string, Array<{ id: string; name: string }>>();
  for (const p of (players ?? []) as Array<{ id: string; name: string; team_id: string | null }>) {
    if (!p.team_id) continue;
    const arr = playersByTeam.get(p.team_id) ?? [];
    arr.push({ id: p.id, name: p.name });
    playersByTeam.set(p.team_id, arr);
  }
  const teamsWithCaptain = ((teams ?? []) as any[]).map((t) => ({
    ...t,
    captain_name: captainMap.get(t.id)?.name ?? null,
    captain_phone: captainMap.get(t.id)?.phone ?? null,
    players: playersByTeam.get(t.id) ?? [],
  }));
  return <TeamsAdmin teams={teamsWithCaptain} />;
}
