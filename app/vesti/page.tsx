import { createAdminClient } from "@/lib/supabase/admin";
import { VestiList } from "./VestiList";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function VestiPage() {
  const admin = createAdminClient();
  const { data: news } = await admin
    .from("news")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false });
  return <VestiList initial={(news ?? []) as any[]} />;
}
