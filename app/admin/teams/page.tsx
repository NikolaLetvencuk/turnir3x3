import { createClient } from "@/lib/supabase/server";
import { TeamsAdmin } from "./TeamsAdmin";

export const revalidate = 0;

export default async function TeamsAdminPage() {
  const supabase = createClient();
  const { data: teams } = await supabase.from("teams").select("*").order("name");
  return <TeamsAdmin teams={(teams ?? []) as any[]} />;
}
