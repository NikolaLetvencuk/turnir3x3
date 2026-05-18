import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { DrawWatcher } from "./DrawWatcher";

export const revalidate = 0;

export default async function PublicDrawPage() {
  const [profile, dsRes] = await Promise.all([
    getCurrentProfile(),
    createAdminClient().from("draw_state").select("*").eq("id", true).maybeSingle(),
  ]);
  return <DrawWatcher initial={(dsRes.data as any) ?? null} isAdmin={profile?.role === "admin"} />;
}
