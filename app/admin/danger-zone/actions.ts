"use server";

import { requireAdmin } from "@/lib/auth";
import { performReset } from "@/lib/reset";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function adminResetAll(): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e: any) {
    return { ok: false, error: e.message ?? "Forbidden" };
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { ok: false, error: "ADMIN_EMAIL nije postavljen" };
  return performReset(adminEmail);
}
