"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const createSchema = z.object({ name: z.string().min(2).max(60) });

export async function createLeague(formData: FormData): Promise<ActionResult<{ id: string; invite_code: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nije prijavljen" };
  const parsed = createSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: "Naziv nije validan" };

  const admin = createAdminClient();
  const { data: codeRow } = await admin.rpc("generate_invite_code");
  const invite_code = (codeRow as unknown as string) ?? Math.random().toString(36).slice(2, 8).toUpperCase();

  const { data: league, error } = await admin
    .from("fantasy_leagues")
    .insert({ name: parsed.data.name, owner_id: user.id, invite_code })
    .select("id, invite_code")
    .single();
  if (error || !league) return { ok: false, error: error?.message ?? "Greška" };

  await admin.from("fantasy_league_members").insert({ league_id: league.id, user_id: user.id });
  revalidatePath("/fantasy/leagues");
  return { ok: true, data: { id: league.id, invite_code: league.invite_code } };
}

const joinSchema = z.object({ code: z.string().length(6) });

export async function joinLeague(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nije prijavljen" };
  const raw = (formData.get("code") as string ?? "").trim().toUpperCase();
  const parsed = joinSchema.safeParse({ code: raw });
  if (!parsed.success) return { ok: false, error: "Kod mora biti 6 znakova" };

  const admin = createAdminClient();
  const { data: league } = await admin.from("fantasy_leagues").select("id").eq("invite_code", parsed.data.code).maybeSingle();
  if (!league) return { ok: false, error: "Kod ne postoji" };

  const { data: existing } = await admin
    .from("fantasy_league_members")
    .select("user_id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { ok: false, error: "Već si član ove lige" };

  const { error } = await admin.from("fantasy_league_members").insert({ league_id: league.id, user_id: user.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fantasy/leagues");
  return { ok: true, data: { id: league.id } };
}
