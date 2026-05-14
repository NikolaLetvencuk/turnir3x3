import { createClient } from "@/lib/supabase/server";
import { GroupsAdmin } from "./GroupsAdmin";

export const revalidate = 0;

export default async function GroupsAdminPage() {
  const supabase = createClient();
  const [{ data: groups }, { data: teams }, { data: gt }] = await Promise.all([
    supabase.from("groups").select("*").order("display_order"),
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("group_teams").select("group_id, team_id"),
  ]);
  const map = new Map<string, string>();
  for (const x of (gt ?? []) as Array<{ team_id: string; group_id: string }>) map.set(x.team_id, x.group_id);
  return <GroupsAdmin groups={groups ?? []} teams={teams ?? []} assignment={Object.fromEntries(map)} />;
}
