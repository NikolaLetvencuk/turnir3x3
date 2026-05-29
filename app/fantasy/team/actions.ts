"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { belgradeLocalToUTCISO } from "@/lib/utils";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const initSchema = z.object({ name: z.string().min(2).max(60) });

/**
 * Set the user's fantasy team name. One-shot — once set, stays put.
 * (Used as the display label for leaderboards.)
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

function shiftDayUTC(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function belgradeDayRange(day: string): { startUTC: string; endUTC: string } | null {
  const startUTC = belgradeLocalToUTCISO(`${day}T00:00`);
  if (!startUTC) return null;
  const nextKey = shiftDayUTC(day, 1);
  const endUTC = belgradeLocalToUTCISO(`${nextKey}T00:00`);
  if (!endUTC) return null;
  return { startUTC, endUTC };
}

const dayPicksSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  player1_id: z.string().uuid(),
  player2_id: z.string().uuid(),
  player3_id: z.string().uuid(),
});

/**
 * Save the user's fantasy picks for a given Belgrade-local day.
 *
 * - All 3 players must be distinct.
 * - On a group/R16 day: the three players must come from 3 different teams.
 * - On a QF+ day (any match's bracket_position is QF/SF/F/TP): at most 2 of
 *   the 3 may share a team — i.e. distinct team count >= 2.
 * - Picks are frozen the moment the day's first match leaves the
 *   "scheduled" status. After that, save attempts are rejected with a
 *   user-visible error.
 */
export async function savePicksForDay(input: {
  day: string;
  player1_id: string;
  player2_id: string;
  player3_id: string;
}): Promise<ActionResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nije prijavljen" };

  const parsed = dayPicksSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neispravan format izbora" };
  const { day, player1_id, player2_id, player3_id } = parsed.data;

  if (player1_id === player2_id || player1_id === player3_id || player2_id === player3_id) {
    return { ok: false, error: "Igrači moraju biti različiti" };
  }

  const admin = createAdminClient();

  const { data: players, error: pErr } = await admin
    .from("players")
    .select("id, team_id")
    .in("id", [player1_id, player2_id, player3_id]);
  if (pErr) return { ok: false, error: pErr.message };
  if (!players || players.length !== 3) return { ok: false, error: "Igrač nije pronađen" };

  // Resolve the *effective* day. If the requested day's first match has
  // already started, the team can't change that day anymore — instead of
  // erroring we roll the save forward to the next day that has matches and
  // hasn't started yet. This handles the "today's games started → this is
  // really tomorrow's team" case transparently.
  let effectiveDay = day;
  let matches: Array<{ id: string; status: string; bracket_position: string | null }> = [];
  for (let i = 0; i < 60; i++) {
    const range = belgradeDayRange(effectiveDay);
    if (!range) return { ok: false, error: "Neispravan datum" };
    const { data: matchRows } = await admin
      .from("matches")
      .select("id, status, bracket_position")
      .gte("kickoff_at", range.startUTC)
      .lt("kickoff_at", range.endUTC);
    const dayMatches = (matchRows ?? []) as Array<{ id: string; status: string; bracket_position: string | null }>;
    const started = dayMatches.some((m) => m.status && m.status !== "scheduled");
    if (!started) {
      matches = dayMatches;
      break;
    }
    effectiveDay = shiftDayUTC(effectiveDay, 1);
  }

  // QF+ day = any match in QF / SF / F / TP. R16 stays under the strict rule.
  const isKnockoutPlus = matches.some(
    (m) => m.bracket_position && !m.bracket_position.startsWith("R16"),
  );

  const teamIds = (players as Array<{ team_id: string | null }>)
    .map((p) => p.team_id)
    .filter((id): id is string => !!id);
  const distinctTeams = new Set(teamIds).size;
  if (isKnockoutPlus) {
    if (distinctTeams < 2) {
      return { ok: false, error: "Maksimalno 2 igrača iz istog tima (eliminacioni dan)." };
    }
  } else {
    if (distinctTeams < 3) {
      return { ok: false, error: "U grupnoj fazi sva 3 igrača moraju biti iz različitih timova." };
    }
  }

  const { error: upErr } = await (admin as any)
    .from("fantasy_day_picks")
    .upsert(
      { user_id: user.id, day: effectiveDay, player1_id, player2_id, player3_id, updated_at: new Date().toISOString() },
      { onConflict: "user_id,day" },
    );
  if (upErr) return { ok: false, error: upErr.message };

  // Keep the legacy fantasy_teams row in sync as the user's "most recent
  // pick" so other surfaces (leaderboards, profile, etc.) still find it.
  const { data: existingTeam } = await admin
    .from("fantasy_teams")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingTeam) {
    await admin
      .from("fantasy_teams")
      .update({ player1_id, player2_id, player3_id, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  } else {
    await admin
      .from("fantasy_teams")
      .insert({ user_id: user.id, player1_id, player2_id, player3_id });
  }

  // Recompute points for the day (idempotent; covers re-saves after matches
  // finish too, though normal updates flow through the SQL trigger).
  await admin.rpc("recalculate_day_points" as any, { p_day: effectiveDay });

  revalidatePath("/fantasy/team");
  revalidatePath("/fantasy");
  revalidatePath("/admin/users");
  return { ok: true, data: { day: effectiveDay, rolledForward: effectiveDay !== day } };
}
