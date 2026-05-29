"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { belgradeLocalToUTCISO } from "@/lib/utils";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function withAdmin<T>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try { await requireAdmin(); return await fn(); }
  catch (e: any) { return { ok: false, error: e.message ?? "Forbidden" }; }
}

// TEAMS
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Nevažeća hex boja");

export async function createTeam(formData: FormData): Promise<ActionResult<{ id: string }>> {
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
    const { data, error } = await admin
      .from("teams")
      .insert({ name, short_name, primary_color, secondary_color })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Greška" };
    revalidatePath("/admin/teams");
    revalidatePath("/admin/players");
    return { ok: true, data: { id: data.id as string } };
  }) as Promise<ActionResult<{ id: string }>>;
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

async function ensureTeamCrestBucket(admin: ReturnType<typeof createAdminClient>) {
  // Idempotent: skip the create call if the bucket is already there. Avoids
  // requiring migration 0026 to be applied before the upload UI works.
  const { data: existing } = await admin.storage.getBucket("team-crests");
  if (existing) return;
  await admin.storage.createBucket("team-crests", { public: true });
}

// TEAM CRESTS — optional uploaded crest image. Stored at team-crests/<team_id>/<ts>.jpg.
export async function uploadTeamCrest(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const team_id = formData.get("team_id") as string;
    const file = formData.get("file") as File | null;
    if (!team_id || !file) return { ok: false, error: "Nedostaje fajl ili tim" };
    if (file.size > 300 * 1024) return { ok: false, error: "Fajl je veći od 300KB" };
    const admin = createAdminClient();
    await ensureTeamCrestBucket(admin);

    const path = `${team_id}/${Date.now()}.jpg`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from("team-crests")
      .upload(path, buf, { contentType: "image/jpeg", upsert: true });
    if (upErr) return { ok: false, error: upErr.message };

    const { data: pub } = admin.storage.from("team-crests").getPublicUrl(path);
    const logo_url = pub.publicUrl;

    // Cleanup older uploads for the same team
    const { data: prior } = await admin.storage.from("team-crests").list(team_id, { limit: 100 });
    const toDelete = (prior ?? [])
      .filter((f) => f.name !== path.split("/")[1])
      .map((f) => `${team_id}/${f.name}`);
    if (toDelete.length) await admin.storage.from("team-crests").remove(toDelete);

    const { error } = await admin.from("teams").update({ logo_url }).eq("id", team_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/teams");
    revalidatePath("/admin/players");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function removeTeamCrest(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const team_id = formData.get("team_id") as string;
    if (!team_id) return { ok: false, error: "Nedostaje tim" };
    const admin = createAdminClient();
    const { data: prior } = await admin.storage.from("team-crests").list(team_id, { limit: 100 });
    const paths = (prior ?? []).map((f) => `${team_id}/${f.name}`);
    if (paths.length) await admin.storage.from("team-crests").remove(paths);
    const { error } = await admin.from("teams").update({ logo_url: null }).eq("id", team_id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/teams");
    revalidatePath("/admin/players");
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
    if (!name) return { ok: false, error: "Ime obavezno" };
    const admin = createAdminClient();
    const { error } = await admin.from("players").insert({ name, team_id });
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
    const admin = createAdminClient();
    const { error } = await admin.from("players").update({ name, team_id }).eq("id", id);
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

// MATCHES — matches are created exclusively by the draw (commitDraw) and bracket generator
// (generateKnockoutBracket), both of which use the admin client directly. There is no
// public createMatch / deleteMatch Server Action; matches can only be cleared via reset.

// Bulk-fill kickoff times for a list of matches, starting at `start` (Belgrade local),
// each subsequent match offset by `gap_minutes`. Order is preserved from input.
const bulkSchema = z.object({
  ordered_match_ids: z.array(z.string().uuid()).min(1),
  start: z.string().min(1),
  gap_minutes: z.number().int().min(0).max(24 * 60),
});

const bulkAutoFillSchema = z.object({
  ordered_matches: z
    .array(
      z.object({
        id: z.string().uuid(),
        round_id: z.string().uuid(),
      }),
    )
    .min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{1,2}:\d{2}$/),
  match_duration: z.number().int().min(5).max(24 * 60),
  max_per_day: z.number().int().min(1).max(100),
  skip_dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),
});

function shiftDayUTC(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Split `total` matches into a list of per-day counts.
 *
 * - Every day gets at least 3 matches whenever `total >= 3` (so we never
 *   leave a tail of 1-2). To keep `>= 3` per day, the algorithm reduces the
 *   number of days even if that means slightly exceeding `maxPerDay`.
 * - When `total < 3` (e.g. a 2-match SF or a single-match Final) we accept
 *   a smaller day because the bracket structure leaves no choice.
 */
function splitPoolIntoDays(total: number, maxPerDay: number): number[] {
  if (total <= 0) return [];
  if (total < 3) return [total];
  if (total <= maxPerDay) return [total];
  let days = Math.ceil(total / maxPerDay);
  while (days > 1 && Math.floor(total / days) < 3) days--;
  const base = Math.floor(total / days);
  const rem = total % days;
  return Array.from({ length: days }, (_, i) => (i < rem ? base + 1 : base));
}

/**
 * Auto-fill kickoff times for a list of matches across multiple days.
 *
 * - Group-stage matches share days freely; knockout rounds always start on a
 *   new day and never overlap each other (R16 / QF / SF / F+TP each get
 *   their own day(s)).
 * - Each day holds at least 3 matches whenever possible (`>= 3` rule).
 * - Skips days listed in `skip_dates`.
 */
export async function bulkAutoFillKickoffs(input: {
  ordered_matches: Array<{ id: string; round_id: string }>;
  start_date: string;
  start_time: string;
  match_duration: number;
  max_per_day: number;
  skip_dates: string[];
}): Promise<ActionResult> {
  return withAdmin(async () => {
    const parsed = bulkAutoFillSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Neispravni podaci" };
    const { ordered_matches, start_date, start_time, match_duration, max_per_day, skip_dates } = parsed.data;
    const skipSet = new Set(skip_dates);

    const admin = createAdminClient();

    const uniqueRoundIds = Array.from(new Set(ordered_matches.map((m) => m.round_id)));
    const { data: roundRows } = await admin
      .from("rounds")
      .select("id, stage")
      .in("id", uniqueRoundIds);
    const stageByRound = new Map<string, string>(
      ((roundRows ?? []) as Array<{ id: string; stage: string }>).map((r) => [r.id, r.stage]),
    );

    // Bucket matches into "pools": all group matches share a pool; each
    // knockout round is its own pool. Pools are scheduled in order and
    // every pool starts on a fresh day.
    type Pool = { matches: Array<{ id: string; round_id: string }>; label: string };
    const groupPool: Pool = { matches: [], label: "group" };
    const knockoutPools = new Map<string, Pool>();
    const knockoutOrder: string[] = [];
    for (const m of ordered_matches) {
      const stage = stageByRound.get(m.round_id) ?? "group";
      if (stage === "knockout") {
        if (!knockoutPools.has(m.round_id)) {
          knockoutPools.set(m.round_id, { matches: [], label: `ko-${m.round_id}` });
          knockoutOrder.push(m.round_id);
        }
        knockoutPools.get(m.round_id)!.matches.push(m);
      } else {
        groupPool.matches.push(m);
      }
    }
    const pools: Pool[] = [];
    if (groupPool.matches.length > 0) pools.push(groupPool);
    for (const rid of knockoutOrder) pools.push(knockoutPools.get(rid)!);

    let day = start_date;
    while (skipSet.has(day)) day = shiftDayUTC(day, 1);
    let firstPool = true;

    for (const pool of pools) {
      if (!firstPool) {
        day = shiftDayUTC(day, 1);
        while (skipSet.has(day)) day = shiftDayUTC(day, 1);
      }
      firstPool = false;

      const plan = splitPoolIntoDays(pool.matches.length, max_per_day);
      let matchIdx = 0;
      for (let d = 0; d < plan.length; d++) {
        if (d > 0) {
          day = shiftDayUTC(day, 1);
          while (skipSet.has(day)) day = shiftDayUTC(day, 1);
        }
        const dayCount = plan[d];
        for (let slot = 0; slot < dayCount; slot++) {
          const m = pool.matches[matchIdx++];
          const [hRaw, mRaw] = start_time.split(":");
          const hh = String(parseInt(hRaw, 10)).padStart(2, "0");
          const mm = String(parseInt(mRaw, 10)).padStart(2, "0");
          const baseLocal = `${day}T${hh}:${mm}`;
          const baseUtcIso = belgradeLocalToUTCISO(baseLocal);
          if (!baseUtcIso) return { ok: false, error: `Neispravan datum/vreme za ${day}` };
          const kickoffMs = new Date(baseUtcIso).getTime() + slot * match_duration * 60_000;
          const kickoff_at = new Date(kickoffMs).toISOString();
          const { error } = await admin.from("matches").update({ kickoff_at }).eq("id", m.id);
          if (error) return { ok: false, error: error.message };
        }
      }
    }

    revalidatePath("/admin/matches");
    revalidatePath("/admin/schedule");
    revalidatePath("/matches");
    return { ok: true };
  }) as Promise<ActionResult>;
}

const shiftSchema = z.object({
  off_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  create_news: z.boolean().optional(),
});

function formatSrDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  return `${parseInt(d, 10)}.${parseInt(m, 10)}.${y}`;
}

/**
 * Treat off_date as a no-play day after the schedule is already generated:
 * every match whose kickoff_at falls on or after off_date is pushed forward
 * by one day. Optionally posts a news item ("Sutra se ne igra") so the home
 * page banner reflects the change. Cumulative — call it again for each new
 * off-day; the helper math handles cascading shifts.
 */
export async function shiftScheduleFromDate(input: { off_date: string; create_news?: boolean }): Promise<ActionResult<{ shifted: number }>> {
  return withAdmin(async () => {
    const parsed = shiftSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Neispravni podaci" };
    const { off_date, create_news } = parsed.data;

    const admin = createAdminClient();
    const offUtcIso = belgradeLocalToUTCISO(`${off_date}T00:00:00`);
    if (!offUtcIso) return { ok: false, error: "Neispravan datum" };

    const { data: matchesRaw, error: fetchErr } = await admin
      .from("matches")
      .select("id, kickoff_at")
      .gte("kickoff_at", offUtcIso);
    if (fetchErr) return { ok: false, error: fetchErr.message };

    let shifted = 0;
    for (const m of (matchesRaw ?? []) as Array<{ id: string; kickoff_at: string | null }>) {
      if (!m.kickoff_at) continue;
      const next = new Date(new Date(m.kickoff_at).getTime() + 86_400_000).toISOString();
      const { error } = await admin.from("matches").update({ kickoff_at: next }).eq("id", m.id);
      if (error) return { ok: false, error: error.message };
      shifted++;
    }

    if (create_news) {
      const human = formatSrDate(off_date);
      await admin.from("news").insert({
        title: `${human}. se ne igra`,
        body: `Mečevi planirani za ${human}. su pomereni za jedan dan kasnije. Termini se automatski osvežavaju na sajtu.`,
      });
    }

    revalidatePath("/admin/matches");
    revalidatePath("/admin/schedule");
    revalidatePath("/matches");
    revalidatePath("/vesti");
    revalidatePath("/");
    return { ok: true, data: { shifted } };
  }) as Promise<ActionResult<{ shifted: number }>>;
}

export async function bulkSetMatchKickoffs(input: { ordered_match_ids: string[]; start: string; gap_minutes: number }): Promise<ActionResult> {
  return withAdmin(async () => {
    const parsed = bulkSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Neispravni podaci" };

    const startIso = belgradeLocalToUTCISO(parsed.data.start);
    if (!startIso) return { ok: false, error: "Neispravan datum/vreme" };

    const startMs = new Date(startIso).getTime();
    const gapMs = parsed.data.gap_minutes * 60_000;

    const admin = createAdminClient();
    for (let i = 0; i < parsed.data.ordered_match_ids.length; i++) {
      const kickoff_at = new Date(startMs + i * gapMs).toISOString();
      const { error } = await admin
        .from("matches")
        .update({ kickoff_at })
        .eq("id", parsed.data.ordered_match_ids[i]);
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/admin/matches");
    revalidatePath("/admin/schedule");
    revalidatePath("/matches");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// Set or clear a match's kickoff date/time. Purely informational — doesn't affect phase logic.
export async function setMatchKickoff(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const raw = (formData.get("kickoff_at") as string) || "";
    if (!id) return { ok: false, error: "Nedostaje id meča" };

    let kickoff_at: string | null = null;
    if (raw.trim()) {
      // Browser sends "YYYY-MM-DDTHH:mm" in admin's wall-clock — always Europe/Belgrade for this app.
      const iso = belgradeLocalToUTCISO(raw.trim());
      if (!iso) return { ok: false, error: "Neispravan datum" };
      kickoff_at = iso;
    }
    const admin = createAdminClient();
    const { error } = await admin.from("matches").update({ kickoff_at }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/matches");
    revalidatePath("/admin/schedule");
    revalidatePath("/matches");
    revalidatePath(`/matches/${id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function startFirstHalf(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { data: match } = await admin.from("matches").select("round_id").eq("id", id).maybeSingle();
    if (!match) return { ok: false, error: "Meč ne postoji" };
    await admin.rpc("lock_round", { p_round_id: (match as any).round_id });
    const now = new Date().toISOString();
    const { error } = await admin.from("matches")
      .update({ phase: "first_half", started_at: now, second_half_started_at: null, finished_at: null })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/matches");
    revalidatePath(`/admin/matches/${id}/live`);
    revalidatePath(`/matches/${id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function endFirstHalf(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { error } = await admin.from("matches").update({ phase: "halftime" }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/matches/${id}/live`);
    revalidatePath(`/matches/${id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function startSecondHalf(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { error } = await admin.from("matches")
      .update({ phase: "second_half", second_half_started_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/matches/${id}/live`);
    revalidatePath(`/matches/${id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function startExtraTime(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { error } = await admin.from("matches")
      .update({ phase: "extra_time", extra_time_started_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/matches/${id}/live`);
    revalidatePath(`/matches/${id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

// End ET. If still tied, move to penalty shootout. Otherwise finish with goal-based winner.
export async function endExtraTime(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const admin = createAdminClient();
    const { data: m } = await admin
      .from("matches")
      .select("home_score, away_score, home_team_id, away_team_id, round:rounds(stage)")
      .eq("id", id)
      .maybeSingle();
    if (!m) return { ok: false, error: "Meč ne postoji" };
    const mm = m as any;
    const tied = mm.home_score === mm.away_score;
    if (tied) {
      const { error } = await admin.from("matches").update({ phase: "penalties" }).eq("id", id);
      if (error) return { ok: false, error: error.message };
    } else {
      const winnerId = mm.home_score > mm.away_score ? mm.home_team_id : mm.away_team_id;
      const { error } = await admin.from("matches")
        .update({ phase: "finished", finished_at: new Date().toISOString(), knockout_winner_id: winnerId })
        .eq("id", id);
      if (error) return { ok: false, error: error.message };
      const { resolveAllPlaceholders } = await import("@/lib/resolveBracket");
      await resolveAllPlaceholders();
      revalidatePath("/bracket");
      revalidatePath("/admin/bracket");
    }
    revalidatePath(`/admin/matches/${id}/live`);
    revalidatePath(`/matches/${id}`);
    revalidatePath("/standings");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// Save penalty shootout result and finish match. Best-of-3 means whichever
// side has more pen kicks scored after both have taken at least 3 wins —
// admin enters the final tally so we don't model kick-by-kick.
export async function finishPenalties(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const homePen = Number(formData.get("home_pen"));
    const awayPen = Number(formData.get("away_pen"));
    if (!Number.isFinite(homePen) || !Number.isFinite(awayPen) || homePen < 0 || awayPen < 0) {
      return { ok: false, error: "Neispravan broj penala" };
    }
    if (homePen === awayPen) return { ok: false, error: "Penal-šut mora imati pobednika" };
    const admin = createAdminClient();
    const { data: m } = await admin
      .from("matches")
      .select("home_team_id, away_team_id")
      .eq("id", id)
      .maybeSingle();
    if (!m) return { ok: false, error: "Meč ne postoji" };
    const mm = m as any;
    const winnerId = homePen > awayPen ? mm.home_team_id : mm.away_team_id;
    const { error } = await admin.from("matches")
      .update({
        phase: "finished",
        finished_at: new Date().toISOString(),
        home_pen: homePen,
        away_pen: awayPen,
        knockout_winner_id: winnerId,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    const { resolveAllPlaceholders } = await import("@/lib/resolveBracket");
    await resolveAllPlaceholders();
    revalidatePath(`/admin/matches/${id}/live`);
    revalidatePath(`/matches/${id}`);
    revalidatePath("/bracket");
    revalidatePath("/admin/bracket");
    revalidatePath("/standings");
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function finishMatch(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const knockoutWinnerId = (formData.get("knockout_winner_id") as string) || null;
    const admin = createAdminClient();
    const { data: m } = await admin
      .from("matches")
      .select("started_at, phase, home_score, away_score, bracket_position, round:rounds(stage)")
      .eq("id", id)
      .maybeSingle();
    if (!m) return { ok: false, error: "Meč ne postoji" };
    const mm = m as any;
    if (!mm.started_at) return { ok: false, error: "Meč nije pokrenut" };

    const isKnockout = mm.round?.stage === "knockout";
    const tied = mm.home_score === mm.away_score;
    if (isKnockout && tied && !knockoutWinnerId) {
      return { ok: false, error: "Izjednačeno u nokautu — izaberi pobednika" };
    }

    const update: any = { phase: "finished", finished_at: new Date().toISOString() };
    if (isKnockout && knockoutWinnerId) update.knockout_winner_id = knockoutWinnerId;

    const { error } = await admin.from("matches").update(update).eq("id", id);
    if (error) return { ok: false, error: error.message };

    // Propagate to next round if knockout
    if (isKnockout) {
      const { resolveAllPlaceholders } = await import("@/lib/resolveBracket");
      await resolveAllPlaceholders();
    }

    revalidatePath("/admin/matches");
    revalidatePath(`/admin/matches/${id}/live`);
    revalidatePath(`/matches/${id}`);
    revalidatePath("/standings");
    revalidatePath("/bracket");
    revalidatePath("/admin/bracket");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// MATCH EVENTS — score is maintained by DB trigger refresh_match_score
const eventSchema = z.object({
  match_id: z.string().uuid(),
  player_id: z.string().uuid(),
  team_id: z.string().uuid(),
  assist_player_id: z.string().uuid().nullable().optional(),
  event_type: z.enum(["goal", "own_goal", "yellow_card", "red_card"]),
  minute: z.number().int().min(0).max(200),
});

export async function createMatchEvent(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const parsed = eventSchema.safeParse({
      match_id: formData.get("match_id"),
      player_id: formData.get("player_id"),
      team_id: formData.get("team_id"),
      assist_player_id: (formData.get("assist_player_id") as string) || null,
      event_type: formData.get("event_type"),
      minute: formData.get("minute") ? Number(formData.get("minute")) : NaN,
    });
    if (!parsed.success) return { ok: false, error: "Svi podaci uključujući minut su obavezni" };
    const admin = createAdminClient();
    const { error } = await admin.from("match_events").insert(parsed.data);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/matches/${parsed.data.match_id}/live`);
    revalidatePath(`/matches/${parsed.data.match_id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

export async function deleteMatchEvent(formData: FormData): Promise<ActionResult> {
  return withAdmin(async () => {
    const id = formData.get("id") as string;
    const match_id = formData.get("match_id") as string;
    const admin = createAdminClient();
    const { error } = await admin.from("match_events").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/matches/${match_id}/live`);
    revalidatePath(`/matches/${match_id}`);
    return { ok: true };
  }) as Promise<ActionResult>;
}

// Schedule the live draw. Stores ONLY config (group count + time).
// The actual random distribution is computed at timer expiry by triggerDrawIfDue,
// using teams as they exist at that moment.
export async function scheduleDraw(input: {
  scheduled_at: string;
  group_count: number;
  per_pick_ms?: number;
}): Promise<ActionResult> {
  return withAdmin(async () => {
    const gc = Math.max(2, Math.min(10, Math.floor(input.group_count)));
    if (!Number.isFinite(gc)) return { ok: false, error: "Neispravan broj grupa" };
    const admin = createAdminClient();
    const { error } = await admin.from("draw_state").upsert({
      id: true,
      state: "scheduled",
      scheduled_at: input.scheduled_at,
      group_count: gc,
      per_pick_ms: input.per_pick_ms ?? 5000,
      result: null,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/draw");
    revalidatePath("/admin/draw");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// Admin can change planned group count during the countdown (while result still null).
export async function updateScheduledGroupCount(input: { group_count: number }): Promise<ActionResult> {
  return withAdmin(async () => {
    const gc = Math.max(2, Math.min(10, Math.floor(input.group_count)));
    if (!Number.isFinite(gc)) return { ok: false, error: "Neispravan broj grupa" };
    const admin = createAdminClient();
    const { data: existing } = await admin.from("draw_state").select("state, result").eq("id", true).maybeSingle();
    const e = existing as any;
    if (!e || e.state !== "scheduled") return { ok: false, error: "Nema zakazanog žreba" };
    if (e.result) return { ok: false, error: "Žreb je već povučen — broj grupa se ne može menjati" };
    const { error } = await admin
      .from("draw_state")
      .update({ group_count: gc, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/draw");
    revalidatePath("/admin/draw");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// Anyone-callable: clients call this when their countdown hits zero.
// Atomically computes random distribution from CURRENT teams using stored group_count.
export async function triggerDrawIfDue(): Promise<ActionResult> {
  const admin = createAdminClient();
  const { data: ds } = await admin
    .from("draw_state")
    .select("state, scheduled_at, group_count, result")
    .eq("id", true)
    .maybeSingle();
  const d = ds as any;
  if (!d) return { ok: false, error: "Nema draw stanja" };
  if (d.state !== "scheduled") return { ok: false, error: "Žreb nije zakazan" };
  if (d.result) return { ok: true }; // already drawn
  if (!d.scheduled_at) return { ok: false, error: "Nema vremena žreba" };
  if (new Date(d.scheduled_at).getTime() > Date.now()) return { ok: false, error: "Tajmer još nije istekao" };

  const groupCount = Math.max(2, Math.min(10, Number(d.group_count ?? 2)));

  const { data: teams } = await admin
    .from("teams")
    .select("id, name, short_name, primary_color, secondary_color, logo_url");
  const teamList = ((teams ?? []) as any[]).map((t) => ({
    id: t.id, name: t.name, short_name: t.short_name,
    primary_color: t.primary_color, secondary_color: t.secondary_color,
  }));

  if (teamList.length < groupCount * 2) {
    await admin.from("draw_state").update({
      state: "idle",
      scheduled_at: null,
      result: null,
      updated_at: new Date().toISOString(),
    }).eq("id", true);
    revalidatePath("/draw");
    return { ok: false, error: `Nije bilo dovoljno timova (${teamList.length} < ${groupCount * 2})` };
  }

  const { computeDraw } = await import("@/lib/draw");
  const result = computeDraw(teamList as any, groupCount);

  // Atomic claim: only one concurrent caller wins
  const { data: updated, error } = await admin
    .from("draw_state")
    .update({ result: result as any, state: "running", updated_at: new Date().toISOString() })
    .eq("id", true)
    .is("result", null)
    .eq("state", "scheduled")
    .select()
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updated) return { ok: true }; // race lost — someone else won; that's fine
  revalidatePath("/draw");
  return { ok: true };
}

// After the live animation finishes, admin commits the pre-computed result to actual tables.
export async function commitScheduledDraw(): Promise<ActionResult> {
  return withAdmin(async () => {
    const admin = createAdminClient();
    const { data: ds } = await admin.from("draw_state").select("result").eq("id", true).maybeSingle();
    const result = ((ds as any)?.result) as any;
    if (!result || !result.groups || !result.rounds) {
      return { ok: false, error: "Nema sačuvanog rezultata žreba" };
    }
    const payload = {
      groups: result.groups.map((g: any) => ({ name: g.name, team_ids: g.teams.map((t: any) => t.id) })),
      rounds: result.rounds.map((r: any) => ({
        name: r.name,
        matches: r.matches.map((m: any) => ({ group_index: m.group_index, home_team_id: m.home.id, away_team_id: m.away.id })),
      })),
    };
    return commitDraw(payload);
  }) as Promise<ActionResult>;
}

export async function cancelScheduledDraw(): Promise<ActionResult> {
  return withAdmin(async () => {
    const admin = createAdminClient();
    const { error } = await admin.from("draw_state").upsert({
      id: true,
      state: "idle",
      scheduled_at: null,
      result: null,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/draw");
    revalidatePath("/admin/draw");
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
    // The old fixtures are gone, so any fantasy day picks/points tied to the
    // previous schedule are meaningless — clear them. Leagues + memberships
    // stay; users just rebuild their daily teams against the new fixtures.
    await (admin as any).from("fantasy_day_points").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
    await (admin as any).from("fantasy_day_picks").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");

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

    // Mark the synced draw state as committed (or reset to idle)
    await admin.from("draw_state").upsert({ id: true, state: "committed", updated_at: new Date().toISOString() });

    revalidatePath("/standings");
    revalidatePath("/matches");
    revalidatePath("/admin");
    revalidatePath("/admin/groups");
    revalidatePath("/admin/matches");
    revalidatePath("/admin/schedule");
    revalidatePath("/draw");
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

// SITE SETTINGS: popup ad toggle
export async function setPopupAdEnabled(enabled: boolean): Promise<ActionResult> {
  return withAdmin(async () => {
    const admin = createAdminClient();
    const { error } = await admin.from("app_settings").upsert({
      key: "popup_ad_enabled",
      value: enabled,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// NEWS: admin posts news items, public sees latest on homepage.
const newsSchema = z.object({
  title: z.string().trim().min(2, "Naslov mora imati bar 2 znaka").max(120, "Naslov je predugačak"),
  body: z.string().trim().min(2, "Tekst mora imati bar 2 znaka").max(2000, "Tekst je predugačak"),
});

export async function createNews(input: { title: string; body: string }): Promise<ActionResult<{ id: string }>> {
  return withAdmin(async () => {
    const parsed = newsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Neispravan unos" };
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("news")
      .insert({ title: parsed.data.title, body: parsed.data.body })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Greška" };
    revalidatePath("/");
    revalidatePath("/admin/news");
    return { ok: true, data: { id: (data as { id: string }).id } };
  }) as Promise<ActionResult<{ id: string }>>;
}

export async function deleteNews(input: { id: string }): Promise<ActionResult> {
  return withAdmin(async () => {
    const admin = createAdminClient();
    const { error } = await admin.from("news").delete().eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    revalidatePath("/admin/news");
    return { ok: true };
  }) as Promise<ActionResult>;
}

// TEAM CAPTAINS: name + phone per team, admin-only data.
const captainSchema = z.object({
  team_id: z.string().uuid(),
  name: z.string().trim().max(80).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
});

export async function setCaptainPhone(input: {
  team_id: string;
  name?: string | null;
  phone?: string | null;
}): Promise<ActionResult> {
  return withAdmin(async () => {
    const parsed = captainSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Neispravan unos" };
    const admin = createAdminClient();
    const name = parsed.data.name?.trim() || null;
    const phone = parsed.data.phone?.trim() || null;
    if (!name && !phone) {
      // Clear the row if both fields are empty.
      await admin.from("team_captains").delete().eq("team_id", parsed.data.team_id);
    } else {
      const { error } = await admin
        .from("team_captains")
        .upsert(
          { team_id: parsed.data.team_id, name, phone, updated_at: new Date().toISOString() },
          { onConflict: "team_id" },
        );
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath("/admin/teams");
    revalidatePath("/admin/news");
    return { ok: true };
  }) as Promise<ActionResult>;
}
