"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const saveSchema = z.object({
  name: z.string().max(60).optional().nullable(),
  player1_id: z.string().uuid(),
  player2_id: z.string().uuid(),
  player3_id: z.string().uuid(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveTeam(formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nije prijavljen" };

  const parsed = saveSchema.safeParse({
    name: (formData.get("name") as string) || null,
    player1_id: formData.get("player1_id"),
    player2_id: formData.get("player2_id"),
    player3_id: formData.get("player3_id"),
  });
  if (!parsed.success) return { ok: false, error: "Neispravni podaci" };
  const { name, player1_id, player2_id, player3_id } = parsed.data;
  if (player1_id === player2_id || player1_id === player3_id || player2_id === player3_id) {
    return { ok: false, error: "Igrači moraju biti različiti" };
  }

  // Block if active round exists
  const { data: activeRound } = await supabase.from("rounds").select("id").eq("status", "active").limit(1).maybeSingle();
  if (activeRound) return { ok: false, error: "Tim se ne može menjati tokom aktivnog kola" };

  const admin = createAdminClient();

  // Fetch existing for transfer logging
  const { data: existing } = await admin.from("fantasy_teams").select("*").eq("user_id", user.id).maybeSingle();
  const { data: nextRound } = await admin.from("rounds").select("id").eq("status", "upcoming").order("display_order").limit(1).maybeSingle();

  if (existing) {
    const newSet = [player1_id, player2_id, player3_id];
    const oldSet = [existing.player1_id, existing.player2_id, existing.player3_id].filter(Boolean) as string[];
    const outgoing = oldSet.filter((id) => !newSet.includes(id));
    const incoming = newSet.filter((id) => !oldSet.includes(id));
    if (nextRound && (outgoing.length || incoming.length)) {
      const rows = outgoing.map((out, i) => ({
        user_id: user.id,
        round_id: nextRound.id,
        player_out_id: out,
        player_in_id: incoming[i] ?? null,
      }));
      if (rows.length) await admin.from("player_transfers").insert(rows);
    }
    const { error } = await admin
      .from("fantasy_teams")
      .update({ name, player1_id, player2_id, player3_id, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin
      .from("fantasy_teams")
      .insert({ user_id: user.id, name, player1_id, player2_id, player3_id });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/fantasy/team");
  return { ok: true };
}
