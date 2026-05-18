import { createAdminClient } from "@/lib/supabase/admin";

export type PopupAdSetting = {
  enabled: boolean;
  updatedAt: string | null;
};

export async function getPopupAdSetting(): Promise<PopupAdSetting> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", "popup_ad_enabled")
    .maybeSingle();
  const row = data as { value: unknown; updated_at: string | null } | null;
  return {
    enabled: row?.value === true,
    updatedAt: row?.updated_at ?? null,
  };
}
