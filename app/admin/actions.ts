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
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Nevažeća hex boja");

export async function createTeam(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const name = (formData.get("name") as string ?? "").trim();
    const short_name = (formData.get("short_name") as string ?? "").trim() || null;
    const primary_color = (formData.get("primary_color") as string ?? "#1f2937").trim();
    const secondary_color = (formData.get("secondary_color") as string ?? "#f3f4f6").trim();
    if (!name) return { ok: false, error: "Naziv obavezan" };
    if (!hexColor.safeParse(primary_color).success || !hexColor.safeParse(secondary_color).success) {
      return { ok: false, error: "Nevažeća boja" };
    }
    const admin = createAdminClient();
    const { error } = await admin.from("teams").insert({ name, short_name, primary_color, secondary_color });
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
    const primary_color = (formData.get("primary_color") as string ?? "#1f2937").trim();
    const secondary_color = (formData.get("secondary_color") as string ?? "#f3f4f6").trim();
    if (!hexColor.safeParse(primary_color).success || !hexColor.safeParse(secondary_color).success) {
      return { ok: false, error: "Nevažeća boja" };
    }
    const admin = createAdminClient();
    const { error } = await admin.from("teams").update({ name, short_name, primary_color, secondary_color }).eq("id", id);
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

// PLAYER PHOTOS
export async function uploadPlayerPhoto(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const player_id = formData.get("player_id") as string;
    const file = formData.get("file") as File | null;
    if (!player_id || !file) return { ok: false, error: "Nedostaje fajl ili igrač" };
    if (file.size > 200 * 1024) return { ok: false, error: "Fajl je veći od 200KB" };
    const admin = createAdminClient();

    const path = `${player_id}/${Date.now()}.jpg`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("player-photos")
      .upload(path, buf, { contentType: "image/jpeg", upsert: true });
    if (upErr) return { ok: false, error: upErr.message };

    const { data: pub } = admin.storage.from("player-photos").getPublicUrl(path);
    const photo_url = pub.publicUrl;

    // Delete old files for this player (cleanup)
    const { data: prior } = await admin.storage.from("player-photos").list(player_id, { limit: 100 });
    const toDelete = (prior ?? []).filter((f) => f.name !== path.split("/")[1]).map((f) => `${player_id}/${f.name}`);
    if (toDelete.length) await admin.storage.from("player-photos").remove(toDelete);

    const { error } = await admin.from("players").update({ photo_url }).eq("id", player_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/players");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function removePlayerPhoto(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const player_id = formData.get("player_id") as string;
    const admin = createAdminClient();
    const { data: prior } = await admin.storage.from("player-photos").list(player_id, { limit: 100 });
    const paths = (prior ?? []).map((f) => `${player_id}/${f.name}`);
    if (paths.length) await admin.storage.from("player-photos").remove(paths);
    const { error } = await admin.from("players").update({ photo_url: null }).eq("id", player_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/players");
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
    try {
      const { data: prior } = await admin.storage.from("player-photos").list(id, { limit: 100 });
      const paths = (prior ?? []).map((f) => `${id}/${f.name}`);
      if (paths.length) await admin.storage.from("player-photos").remove(paths);
    } catch {
      // best-effort
    }
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

// DRAW: commit pre-computed draw to DB; wipes existing groups/group_teams/rounds/matches first
export async function commitDraw(payload: {
  groups: Array<{ name: string; team_ids: string[] }>;
  rounds: Array<{ name: string; matches: Array<{ group_index: number; home_team_id: string; away_team_id: string }> }>;
}): Promise<ActionResult> {
  return withAdmin(async () => {
    const admin = createAdminClient();
    // Wipe existing fixtures (keep teams, players)
    await admin.from("match_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("group_teams").delete().neq("group_id", "00000000-0000-0000-0000-000000000000");
    await admin.from("rounds").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await admin.from("groups").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Insert groups
    const groupRows = payload.groups.map((g, i) => ({ name: g.name, display_order: i }));
    const { data: insertedGroups, error: gErr } = await admin.from("groups").insert(groupRows).select();
    if (gErr || !insertedGroups) return { ok: false, error: gErr?.message ?? "Greška sa grupama" };

    // group_teams
    const gtRows: Array<{ group_id: string; team_id: string }> = [];
    insertedGroups.forEach((g: any, i: number) => {
      payload.groups[i].team_ids.forEach((tid) => gtRows.push({ group_id: g.id, team_id: tid }));
    });
    if (gtRows.length) {
      const { error: gtErr } = await admin.from("group_teams").insert(gtRows);
      if (gtErr) return { ok: false, error: gtErr.message };
    }

    // rounds
    const roundRows = payload.rounds.map((r, i) => ({ name: r.name, stage: "group", display_order: i }));
    const { data: insertedRounds, error: rErr } = await admin.from("rounds").insert(roundRows).select();
    if (rErr || !insertedRounds) return { ok: false, error: rErr?.message ?? "Greška sa kolima" };

    // matches
    const matchRows: any[] = [];
    insertedRounds.forEach((r: any, ri: number) => {
      payload.rounds[ri].matches.forEach((m) => {
        matchRows.push({
          round_id: r.id,
          group_id: insertedGroups[m.group_index].id,
          home_team_id: m.home_team_id,
          away_team_id: m.away_team_id,
        });
      });
    });
    if (matchRows.length) {
      const { error: mErr } = await admin.from("matches").insert(matchRows);
      if (mErr) return { ok: false, error: mErr.message };
    }

    revalidatePath("/standings");
    revalidatePath("/matches");
    revalidatePath("/admin");
    revalidatePath("/admin/groups");
    revalidatePath("/admin/matches");
    revalidatePath("/admin/schedule");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// SCHEDULE: move a match to a different round
export async function moveMatchToRound(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const match_id = formData.get("match_id") as string;
    const round_id = formData.get("round_id") as string;
    if (!match_id || !round_id) return { ok: false, error: "Neispravni podaci" };
    const admin = createAdminClient();
    // Verify target round is not active/finished
    const { data: round } = await admin.from("rounds").select("status").eq("id", round_id).maybeSingle();
    const rstatus = (round as any)?.status;
    if (rstatus === "active" || rstatus === "finished") return { ok: false, error: "Kolo je zaključano" };
    const { error } = await admin.from("matches").update({ round_id }).eq("id", match_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/schedule");
    revalidatePath("/matches");
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
