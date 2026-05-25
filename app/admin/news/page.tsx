import { createAdminClient } from "@/lib/supabase/admin";
import { NewsAdmin, type NewsRow } from "./NewsAdmin";

export const revalidate = 0;

export default async function AdminNewsPage() {
  const admin = createAdminClient();
  const { data: news } = await admin
    .from("news")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false });
  return <NewsAdmin news={(news ?? []) as NewsRow[]} />;
}
