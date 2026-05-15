import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ResetMode = "soft" | "full";

export async function performReset(adminEmail: string, mode: ResetMode = "soft"): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  if (mode === "full") {
    const { error: dbErr } = await admin.rpc("reset_tournament_data");
    if (dbErr) return { ok: false, error: `DB reset: ${dbErr.message}` };
  } else {
    const { error: dbErr } = await admin.rpc("reset_tournament_progress");
    if (dbErr) return { ok: false, error: `Soft reset: ${dbErr.message}` };
  }

  // Always wipe non-admin auth users
  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of usersList?.users ?? []) {
    if (u.email !== adminEmail) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }

  // Only wipe storage on full reset
  if (mode === "full") {
    try {
      const { data: top } = await admin.storage.from("player-photos").list("", { limit: 10000 });
      const paths: string[] = [];
      for (const entry of top ?? []) {
        if (!entry.name) continue;
        const { data: inner } = await admin.storage.from("player-photos").list(entry.name, { limit: 1000 });
        for (const f of inner ?? []) paths.push(`${entry.name}/${f.name}`);
      }
      if (paths.length) await admin.storage.from("player-photos").remove(paths);
    } catch {
      // Bucket may not exist yet — ignore
    }
  }

  // Re-verify admin profile
  const { data: postList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const adminUser = postList?.users.find((u) => u.email === adminEmail);
  if (adminUser) {
    await admin.from("profiles").upsert({ id: adminUser.id, email: adminEmail, role: "admin" });
  }

  return { ok: true };
}
