"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function withAdmin<T>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try { await requireAdmin(); return await fn(); }
  catch (e: any) { return { ok: false, error: e.message ?? "Forbidden" }; }
}

// TEAMS
export async function createTeam(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const name = (formData.get("name") as string ?? "").trim();
    const short_name = (formData.get("short_name") as string ?? "").trim() || null;
    if (!name) return { ok: false, error: "Naziv obavezan" };
    const admin = createAdminClient();
    const { error } = await admin.from("teams").insert({ name, short_name });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/teams");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function updateTeam(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const name = (formData.get("name") as string ?? "").trim();
    const short_name = (formData.get("short_name") as string ?? "").trim() || null;
    const admin = createAdminClient();
    const { error } = await admin.from("teams").update({ name, short_name }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/teams");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function deleteTeam(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { error } = await admin.from("teams").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/teams");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// PLAYERS
export async function createPlayer(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const name = (formData.get("name") as string ?? "").trim();
    const team_id = (formData.get("team_id") as string) || null;
    const position = (formData.get("position") as string) || null;
    if (!name) return { ok: false, error: "Ime obavezno" };
    const admin = createAdminClient();
    const { error } = await admin.from("players").insert({ name, team_id, position });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/players");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function updatePlayer(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const name = (formData.get("name") as string ?? "").trim();
    const team_id = (formData.get("team_id") as string) || null;
    const position = (formData.get("position") as string) || null;
    const admin = createAdminClient();
    const { error } = await admin.from("players").update({ name, team_id, position }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/players");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function deletePlayer(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { error } = await admin.from("players").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/players");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// GROUPS
export async function createGroup(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const name = (formData.get("name") as string ?? "").trim();
    const display_order = Number(formData.get("display_order") ?? 0);
    if (!name) return { ok: false, error: "Naziv obavezan" };
    const admin = createAdminClient();
    const { error } = await admin.from("groups").insert({ name, display_order });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/groups");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function deleteGroup(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { error } = await admin.from("groups").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/groups");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function setTeamGroup(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const team_id = formData.get("team_id") as string;
    const group_id = (formData.get("group_id") as string) || null;
    const admin = createAdminClient();
    await admin.from("group_teams").delete().eq("team_id", team_id);
    if (group_id) {
      const { error } = await admin.from("group_teams").insert({ group_id, team_id });
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/admin/groups");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// ROUNDS
export async function createRound(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const name = (formData.get("name") as string ?? "").trim();
    const stage = formData.get("stage") as "group" | "knockout";
    const display_order = Number(formData.get("display_order") ?? 0);
    const starts_at = (formData.get("starts_at") as string) || null;
    if (!name || !["group", "knockout"].includes(stage)) return { ok: false, error: "Neispravni podaci" };
    const admin = createAdminClient();
    const { error } = await admin.from("rounds").insert({ name, stage, display_order, starts_at });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/rounds");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function updateRound(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const name = (formData.get("name") as string ?? "").trim();
    const display_order = Number(formData.get("display_order") ?? 0);
    const starts_at = (formData.get("starts_at") as string) || null;
    const admin = createAdminClient();
    const { error } = await admin.from("rounds").update({ name, display_order, starts_at }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/rounds");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function deleteRound(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { error } = await admin.from("rounds").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/rounds");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function activateRound(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { error } = await admin.rpc("lock_round", { p_round_id: id });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/rounds");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// MATCHES
const matchSchema = z.object({
  round_id: z.string().uuid(),
  group_id: z.string().uuid().nullable().optional(),
  home_team_id: z.string().uuid(),
  away_team_id: z.string().uuid(),
  kickoff_at: z.string().nullable().optional(),
  bracket_position: z.string().nullable().optional(),
});

export async function createMatch(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const parsed = matchSchema.safeParse({
      round_id: formData.get("round_id"),
      group_id: (formData.get("group_id") as string) || null,
      home_team_id: formData.get("home_team_id"),
      away_team_id: formData.get("away_team_id"),
      kickoff_at: (formData.get("kickoff_at") as string) || null,
      bracket_position: (formData.get("bracket_position") as string) || null,
    });
    if (!parsed.success) return { ok: false, error: "Neispravni podaci" };
    if (parsed.data.home_team_id === parsed.data.away_team_id) return { ok: false, error: "Domaćin i gost moraju biti različiti" };
    const admin = createAdminClient();
    const { error } = await admin.from("matches").insert(parsed.data);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/matches");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function deleteMatch(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { error } = await admin.from("matches").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/matches");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function startMatch(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { data: match } = await admin.from("matches").select("round_id").eq("id", id).maybeSingle();
    if (!match) return { ok: false, error: "Meč ne postoji" };
    await admin.rpc("lock_round", { p_round_id: match.round_id });
    const { error } = await admin.from("matches").update({ status: "live", started_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/matches");
    revalidatePath(`/admin/matches/${id}/live`);
    revalidatePath(`/matches/${id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function finishMatch(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { error } = await admin.from("matches").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/matches");
    revalidatePath(`/admin/matches/${id}/live`);
    revalidatePath(`/matches/${id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function updateMatchScore(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const home_score = Number(formData.get("home_score") ?? 0);
    const away_score = Number(formData.get("away_score") ?? 0);
    const admin = createAdminClient();
    const { error } = await admin.from("matches").update({ home_score, away_score }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/matches/${id}/live`);
    revalidatePath(`/matches/${id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

// MATCH EVENTS
export async function createMatchEvent(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const match_id = formData.get("match_id") as string;
    const player_id = formData.get("player_id") as string;
    const team_id = formData.get("team_id") as string;
    const assist_player_id = (formData.get("assist_player_id") as string) || null;
    const event_type = formData.get("event_type") as string;
    const minute = formData.get("minute") ? Number(formData.get("minute")) : null;
    if (!match_id || !player_id || !team_id || !event_type) return { ok: false, error: "Neispravni podaci" };
    const admin = createAdminClient();

    // Update score if goal / own_goal
    if (event_type === "goal" || event_type === "own_goal") {
      const { data: m } = await admin.from("matches").select("home_team_id, away_team_id, home_score, away_score").eq("id", match_id).maybeSingle();
      if (m) {
        const scoringTeam = event_type === "own_goal"
          ? (team_id === m.home_team_id ? m.away_team_id : m.home_team_id)
          : team_id;
        const updates: any = {};
        if (scoringTeam === m.home_team_id) updates.home_score = (m.home_score ?? 0) + 1;
        else if (scoringTeam === m.away_team_id) updates.away_score = (m.away_score ?? 0) + 1;
        if (Object.keys(updates).length) await admin.from("matches").update(updates).eq("id", match_id);
      }
    }

    const { error } = await admin.from("match_events").insert({ match_id, player_id, team_id, assist_player_id, event_type, minute });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/matches/${match_id}/live`);
    revalidatePath(`/matches/${match_id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function deleteMatchEvent(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const match_id = formData.get("match_id") as string;
    const admin = createAdminClient();
    const { data: ev } = await admin.from("match_events").select("event_type, team_id").eq("id", id).maybeSingle();
    if (ev && (ev.event_type === "goal" || ev.event_type === "own_goal")) {
      const { data: m } = await admin.from("matches").select("home_team_id, away_team_id, home_score, away_score").eq("id", match_id).maybeSingle();
      if (m) {
        const scoringTeam = ev.event_type === "own_goal"
          ? (ev.team_id === m.home_team_id ? m.away_team_id : m.home_team_id)
          : ev.team_id;
        const updates: any = {};
        if (scoringTeam === m.home_team_id) updates.home_score = Math.max(0, (m.home_score ?? 0) - 1);
        else if (scoringTeam === m.away_team_id) updates.away_score = Math.max(0, (m.away_score ?? 0) - 1);
        if (Object.keys(updates).length) await admin.from("matches").update(updates).eq("id", match_id);
      }
    }
    const { error } = await admin.from("match_events").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/matches/${match_id}/live`);
    revalidatePath(`/matches/${match_id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

// FANTASY
export async function recalcRound(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("round_id") as string;
    const admin = createAdminClient();
    const { error } = await admin.rpc("recalculate_round", { p_round_id: id });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/fantasy");
    return { ok: true };
  }) as Promise<ActionResult>;
}
