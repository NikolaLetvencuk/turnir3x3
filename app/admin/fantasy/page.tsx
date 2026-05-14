import { createClient } from "@/lib/supabase/server";
import { FantasyAdmin } from "./FantasyAdmin";

export const revalidate = 0;

export default async function FantasyAdminPage() {
  const supabase = createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").order("display_order");
  return <FantasyAdmin rounds={rounds ?? []} />;
}
