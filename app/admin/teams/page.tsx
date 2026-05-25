import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamsAdmin } from "./TeamsAdmin";

export const revalidate = 0;

export default async function TeamsAdminPage() {
  const supabase = createClient();
  const admin = createAdminClient();
  const [{ data: teams }, { data: captains }] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    admin.from("team_captains").select("team_id, name, phone"),
  ]);
  const captainMap = new Map<string, { name: string | null; phone: string | null }>();
  for (const c of (captains ?? []) as Array<{ team_id: string; name: string | null; phone: string | null }>) {
    captainMap.set(c.team_id, { name: c.name, phone: c.phone });
  }
  const teamsWithCaptain = ((teams ?? []) as any[]).map((t) => ({
    ...t,
    captain_name: captainMap.get(t.id)?.name ?? null,
    captain_phone: captainMap.get(t.id)?.phone ?? null,
  }));
  return <TeamsAdmin teams={teamsWithCaptain} />;
}
