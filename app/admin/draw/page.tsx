import { createClient } from "@/lib/supabase/server";
import { DrawClient } from "./DrawClient";

export const revalidate = 0;

export default async function DrawPage() {
  const supabase = createClient();
  const [{ data: teams }, { data: groups }, { data: matches }] = await Promise.all([
    supabase.from("teams").select("id, name, short_name, primary_color, secondary_color").order("name"),
    supabase.from("groups").select("id").limit(1),
    supabase.from("matches").select("id").limit(1),
  ]);
  const hasExisting = (groups?.length ?? 0) > 0 || (matches?.length ?? 0) > 0;
  return <DrawClient teams={(teams ?? []) as any[]} hasExisting={hasExisting} />;
}
