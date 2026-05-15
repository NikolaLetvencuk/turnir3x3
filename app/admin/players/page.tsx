import { createClient } from "@/lib/supabase/server";
import { PlayersAdmin } from "./PlayersAdmin";

export const revalidate = 0;

export default async function PlayersAdminPage() {
  const supabase = createClient();
  const [{ data: players }, { data: teams }] = await Promise.all([
    supabase.from("players").select("*").order("name"),
    supabase.from("teams").select("id, name, primary_color").order("name"),
  ]);
  return <PlayersAdmin players={(players ?? []) as any[]} teams={(teams ?? []) as any[]} />;
}
