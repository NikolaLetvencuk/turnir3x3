"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { performReset } from "@/lib/reset";
import { createAdminClient } from "@/lib/supabase/admin";
import { seedDemoData } from "@/lib/seed";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function adminResetProgress(): Promise<ActionResult> {
  try { await requireAdmin(); } catch (e: any) { return { ok: false, error: e.message ?? "Forbidden" }; }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { ok: false, error: "ADMIN_EMAIL nije postavljen" };
  const res = await performReset(adminEmail, "soft");
  revalidatePath("/admin");
  return res;
}

export async function adminResetFull(): Promise<ActionResult> {
  try { await requireAdmin(); } catch (e: any) { return { ok: false, error: e.message ?? "Forbidden" }; }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { ok: false, error: "ADMIN_EMAIL nije postavljen" };
  const res = await performReset(adminEmail, "full");
  revalidatePath("/admin");
  return res;
}

// Backwards-compat: older client code may still call adminResetAll. Behaves like full reset.
export const adminResetAll = adminResetFull;

export async function adminSeedDemo(force: boolean): Promise<ActionResult> {
  try { await requireAdmin(); } catch (e: any) { return { ok: false, error: e.message ?? "Forbidden" }; }
  const admin = createAdminClient();
  const res = await seedDemoData(admin as any, force);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/admin/teams");
  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { ok: true };
}
