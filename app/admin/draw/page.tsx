import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DrawClient } from "./DrawClient";

export const revalidate = 0;

export default async function DrawPage() {
  const supabase = createClient();
  const admin = createAdminClient();
  const [{ data: teams }, { data: groups }, { data: matches }, { data: ds }] = await Promise.all([
    supabase.from("teams").select("id, name, short_name, primary_color, secondary_color, logo_url").order("name"),
    supabase.from("groups").select("id").limit(1),
    supabase.from("matches").select("id").limit(1),
    admin.from("draw_state").select("state, scheduled_at, group_count, result").eq("id", true).maybeSingle(),
  ]);
  const hasExisting = (groups?.length ?? 0) > 0 || (matches?.length ?? 0) > 0;
  return (
    <DrawClient
      teams={(teams ?? []) as any[]}
      hasExisting={hasExisting}
      drawState={(ds as any) ?? null}
    />
  );
}
