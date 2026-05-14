import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const p = profile as { id: string; email: string; role: string; created_at: string } | null;
  return p ? { ...p, user } : null;
}

export async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden: admin only");
  }
  return profile;
}

export async function isAdmin(): Promise<boolean> {
  try {
    const profile = await getCurrentProfile();
    return profile?.role === "admin";
  } catch {
    return false;
  }
}
