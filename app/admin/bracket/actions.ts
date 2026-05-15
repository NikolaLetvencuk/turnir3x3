"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBracket } from "@/lib/bracket";
import { resolveAllPlaceholders } from "@/lib/resolveBracket";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function withAdmin<T>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try { await requireAdmin(); return await fn(); }
  catch (e: any) { return { ok: false, error: e.message ?? "Forbidden" }; }
}

const cfgSchema = z.object({
  advancingPerGroup: z.number().int().min(1).max(8),
  bestThirds: z.number().int().min(0).max(8),
  includeThirdPlace: z.boolean(),
});

export async function generateKnockoutBracket(input: { advancingPerGroup: number; bestThirds: number; includeThirdPlace: boolean }): Promise<ActionResult> {
  return withAdmin(async () => {
    const parsed = cfgSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Neispravna konfiguracija" };
    const admin = createAdminClient();

    const { data: groups } = await admin.from("groups").select("id, name, display_order").order("display_order");
    if (!groups || groups.length === 0) return { ok: false, error: "Prvo pokreni žreb grupa" };
    const groupLetters = (groups as any[]).map((g) => {
      const m = g.name.match(/Grupa\s+([A-Z])/i);
      return m ? m[1].toUpperCase() : g.name.slice(-1).toUpperCase();
    });

    let bracket;
    try {
      bracket = generateBracket({
        groupLetters,
        advancingPerGroup: parsed.data.advancingPerGroup,
        bestThirds: parsed.data.bestThirds,
        includeThirdPlace: parsed.data.includeThirdPlace,
      });
    } catch (e: any) {
      return { ok: false, error: e.message ?? "Greška u generisanju" };
    }

    // Wipe existing knockout rounds and their matches
    const { data: koRounds } = await admin.from("rounds").select("id").eq("stage", "knockout");
    const koRoundIds = (koRounds ?? []).map((r: any) => r.id);
    if (koRoundIds.length) {
      await admin.from("match_events").delete().in("match_id",
        ((await admin.from("matches").select("id").in("round_id", koRoundIds)).data ?? []).map((m: any) => m.id),
      );
      await admin.from("matches").delete().in("round_id", koRoundIds);
      await admin.from("rounds").delete().in("id", koRoundIds);
    }

    // Get next display_order
    const { data: lastRound } = await admin.from("rounds").select("display_order").order("display_order", { ascending: false }).limit(1).maybeSingle();
    const baseOrder = ((lastRound as any)?.display_order ?? -1) + 1;

    // Create knockout rounds (one per unique round_name in order)
    const seenNames = new Map<string, number>();
    for (const b of bracket) {
      if (!seenNames.has(b.round_name)) seenNames.set(b.round_name, b.round_index);
    }
    const roundOrder = Array.from(seenNames.entries()).sort((a, b) => a[1] - b[1]);
    const insertRoundRows = roundOrder.map(([name], i) => ({ name, stage: "knockout", display_order: baseOrder + i }));
    const { data: insertedRounds, error: rErr } = await admin.from("rounds").insert(insertRoundRows).select();
    if (rErr || !insertedRounds) return { ok: false, error: rErr?.message ?? "Greška sa kolima" };
    const roundIdByName = new Map((insertedRounds as any[]).map((r) => [r.name, r.id]));

    // Insert matches with placeholders
    const matchRows = bracket.map((b) => ({
      round_id: roundIdByName.get(b.round_name),
      bracket_position: b.bracket_position,
      home_team_id: null,
      away_team_id: null,
      home_placeholder: b.home,
      away_placeholder: b.away,
      group_id: null,
    }));
    const { error: mErr } = await admin.from("matches").insert(matchRows);
    if (mErr) return { ok: false, error: mErr.message };

    // Save config
    await admin.from("tournament_state").upsert({
      id: true,
      advancing_per_group: parsed.data.advancingPerGroup,
      best_thirds: parsed.data.bestThirds,
      include_third_place: parsed.data.includeThirdPlace,
    });

    revalidatePath("/admin/bracket");
    revalidatePath("/bracket");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// Lock group stage: resolve all placeholders
export async function lockGroupStage(input: { force: boolean }): Promise<ActionResult> {
  return withAdmin(async () => {
    const admin = createAdminClient();
    if (!input.force) {
      const { data: unfinished } = await admin.from("matches").select("id, round:rounds(stage, name)").neq("phase", "finished");
      const groupUnfinished = (unfinished ?? []).filter((m: any) => m.round?.stage === "group");
      if (groupUnfinished.length > 0) {
        return { ok: false, error: `Nezavršeno još ${groupUnfinished.length} grupnih mečeva. Koristi „Force lock" ako želiš da nastaviš.` };
      }
    }
    const res = await resolveAllPlaceholders();
    if (!res.ok) return res;
    await admin.from("tournament_state").upsert({
      id: true,
      group_stage_locked: true,
      group_stage_locked_at: new Date().toISOString(),
    });
    revalidatePath("/admin/bracket");
    revalidatePath("/bracket");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// Unlock: clear auto-resolved team_ids on knockout matches, keep manual overrides
export async function unlockGroupStage(): Promise<ActionResult> {
  return withAdmin(async () => {
    const admin = createAdminClient();
    const { data: matches } = await admin
      .from("matches")
      .select("id, home_team_id_manual, away_team_id_manual, home_placeholder, away_placeholder, round:rounds(stage)")
      .not("bracket_position", "is", null);
    for (const m of (matches ?? []) as any[]) {
      if (m.round?.stage !== "knockout") continue;
      const update: any = {};
      if (m.home_placeholder && !m.home_team_id_manual) update.home_team_id = null;
      if (m.away_placeholder && !m.away_team_id_manual) update.away_team_id = null;
      if (Object.keys(update).length) await admin.from("matches").update(update).eq("id", m.id);
    }
    await admin.from("tournament_state").upsert({
      id: true, group_stage_locked: false, group_stage_locked_at: null,
    });
    revalidatePath("/admin/bracket");
    revalidatePath("/bracket");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// Trigger re-resolution after a knockout match finishes
export async function resolveBracketNow(): Promise<ActionResult> {
  return withAdmin(async () => {
    const res = await resolveAllPlaceholders();
    revalidatePath("/admin/bracket");
    revalidatePath("/bracket");
    return res;
  }) as Promise<ActionResult>;
}

// Manual override: set a specific team in a slot
export async function setBracketSlot(input: { match_id: string; slot: "home" | "away"; team_id: string | null }): Promise<ActionResult> {
  return withAdmin(async () => {
    const admin = createAdminClient();
    const col = input.slot === "home" ? "home_team_id_manual" : "away_team_id_manual";
    const realCol = input.slot === "home" ? "home_team_id" : "away_team_id";
    const placeholderCol = input.slot === "home" ? "home_placeholder" : "away_placeholder";
    const update: any = {
      [col]: input.team_id,
      [realCol]: input.team_id,
    };
    if (input.team_id) update[placeholderCol] = null;
    const { error } = await admin.from("matches").update(update).eq("id", input.match_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/bracket");
    revalidatePath("/bracket");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// Restore slot to its placeholder (clears manual override)
export async function clearBracketOverride(input: { match_id: string; slot: "home" | "away" }): Promise<ActionResult> {
  return withAdmin(async () => {
    const admin = createAdminClient();
    const overrideCol = input.slot === "home" ? "home_team_id_manual" : "away_team_id_manual";
    const realCol = input.slot === "home" ? "home_team_id" : "away_team_id";
    const update: Record<string, null> = { [overrideCol]: null, [realCol]: null };
    const { error } = await admin.from("matches").update(update as any).eq("id", input.match_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/bracket");
    revalidatePath("/bracket");
    return { ok: true };
  }) as Promise<ActionResult>;
}
