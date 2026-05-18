"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BASE_PRICE } from "@/lib/fantasy-shared";
import { getUserBudget } from "@/lib/fantasy";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const saveSchema = z.object({
  name: z.string().max(60).optional().nullable(),
  player1_id: z.string().uuid(),
  player2_id: z.string().uuid(),
  player3_id: z.string().uuid(),
});

const initSchema = z.object({
  name: z.string().min(2).max(60),
});

/**
 * Set the team name once — only allowed if it hasn't been set yet. Idempotent.
 */
export async function setTeamName(formData: FormData): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nije prijavljen" };
  const parsed = initSchema.safeParse({ name: (formData.get("name") as string) ?? "" });
  if (!parsed.success) return { ok: false, error: "Naziv mora imati 2–60 znakova" };
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("fantasy_teams")
    .select("user_id, name")
    .eq("user_id", user.id)
    .maybeSingle();
  const e = existing as any;
  if (e && e.name && e.name.trim()) {
    return { ok: false, error: "Ime tima je već postavljeno i ne može se menjati" };
  }
  if (e) {
    const { error } = await admin.from("fantasy_teams").update({ name: parsed.data.name }).eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("fantasy_teams").insert({ user_id: user.id, name: parsed.data.name });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/fantasy/team");
  revalidatePath("/fantasy");
  return { ok: true };
}

// Validate the 3 picks against the user's dynamic budget (team-value-based).
async function computeTeamCost(admin: ReturnType<typeof createAdminClient>, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data: prices } = await admin
    .from("player_prices")
    .select("player_id, price, round_id, round:rounds(display_order)")
    .in("player_id", ids);
  const latestPrice = new Map<string, { price: number; order: number }>();
  for (const p of ((prices ?? []) as any[])) {
    const order = p.round?.display_order ?? 0;
    const cur = latestPrice.get(p.player_id);
    if (!cur || cur.order < order) latestPrice.set(p.player_id, { price: Number(p.price), order });
  }
  return ids.reduce((acc, id) => acc + (latestPrice.get(id)?.price ?? BASE_PRICE), 0);
}

async function validateBudget(admin: ReturnType<typeof createAdminClient>, user_id: string, ids: [string, string, string]): Promise<{ ok: true; total: number; budget: number; bank: number } | { ok: false; error: string }> {
  const total = await computeTeamCost(admin, ids);
  const { budget, bank } = await getUserBudget(user_id);
  // 0.05 tolerance matches the 1-decimal display precision.
  if (total > budget + 0.05) {
    return { ok: false, error: `Prekoračen budžet (${total.toFixed(1)} / ${budget.toFixed(1)})` };
  }
  return { ok: true, total, budget, bank };
}

/**
 * Save the user's working draft (fantasy_teams row). Name is never updated here —
 * it's set once via setTeamName when the user first creates their team.
 */
export async function saveDraft(formData: FormData): Promise<ActionResult> {
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
  const { player1_id, player2_id, player3_id } = parsed.data;
  if (player1_id === player2_id || player1_id === player3_id || player2_id === player3_id) {
    return { ok: false, error: "Igrači moraju biti različiti" };
  }

  const admin = createAdminClient();
  const budget = await validateBudget(admin, user.id, [player1_id, player2_id, player3_id]);
  if (!budget.ok) return budget;

  const { data: existing } = await admin.from("fantasy_teams").select("user_id, name").eq("user_id", user.id).maybeSingle();
  const e = existing as any;
  if (e) {
    if (!e.name || !e.name.trim()) {
      return { ok: false, error: "Prvo postavi ime tima" };
    }
    const { error } = await admin
      .from("fantasy_teams")
      .update({ player1_id, player2_id, player3_id, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    return { ok: false, error: "Prvo postavi ime tima" };
  }
  revalidatePath("/fantasy/team");
  return { ok: true };
}

/**
 * Commit the current draft as the locked team for the upcoming round.
 * Can be re-called multiple times — overwrites the snapshot for the upcoming round.
 */
export async function lockTeamForUpcomingRound(): Promise<ActionResult<{ round_name: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nije prijavljen" };

  const admin = createAdminClient();
  const { data: nextRound } = await admin
    .from("rounds")
    .select("id, name, status, display_order")
    .eq("status", "upcoming")
    .order("display_order")
    .limit(1)
    .maybeSingle();
  if (!nextRound) return { ok: false, error: "Nema predstojećeg kola za lock" };
  const nr = nextRound as any;

  const { data: draft } = await admin
    .from("fantasy_teams")
    .select("player1_id, player2_id, player3_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!draft) return { ok: false, error: "Prvo sastavi tim (3 igrača)" };
  const d = draft as any;
  if (!d.player1_id || !d.player2_id || !d.player3_id) {
    return { ok: false, error: "Izaberi 3 igrača pre lock-a" };
  }

  // Budget check + capture bank (leftover after buying team)
  const budget = await validateBudget(admin, user.id, [d.player1_id, d.player2_id, d.player3_id]);
  if (!budget.ok) return budget;
  const leftover = Math.max(0, Math.round((budget.budget - budget.total) * 100) / 100);

  const { error } = await admin
    .from("fantasy_team_snapshots")
    .upsert(
      {
        user_id: user.id,
        round_id: nr.id,
        player1_id: d.player1_id,
        player2_id: d.player2_id,
        player3_id: d.player3_id,
        transfers_used: 0,
        transfer_penalty: 0,
        bank: leftover,
      },
      { onConflict: "user_id,round_id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/fantasy/team");
  revalidatePath("/fantasy");
  revalidatePath("/profile");
  return { ok: true, data: { round_name: nr.name } };
}
