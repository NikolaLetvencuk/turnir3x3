import { createClient } from "@/lib/supabase/server";
import { RoundsAdmin } from "./RoundsAdmin";

export const revalidate = 0;

export default async function RoundsAdminPage() {
  const supabase = createClient();
  const { data: rounds } = await supabase.from("rounds").select("*").order("display_order");
  return <RoundsAdmin rounds={rounds ?? []} />;
}
