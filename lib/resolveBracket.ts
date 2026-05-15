import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { rankCrossGroup, sortGroupStandings, type StandingsRowWithDiscipline } from "@/lib/groupSorting";
import { resolvePlaceholder } from "@/lib/bracket";

/**
 * Read group standings, compute resolved placeholders, and update knockout matches.
 * Honors manual overrides (home_team_id_manual / away_team_id_manual) — those win over auto-resolution.
 */
export async function resolveAllPlaceholders(): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  // Load groups + standings
  const [{ data: groups }, { data: sview }, { data: matches }, { data: ts }] = await Promise.all([
    admin.from("groups").select("id, name").order("display_order"),
    admin.from("standings").select("*"),
    admin.from("matches").select("id, round_id, bracket_position, home_placeholder, away_placeholder, home_team_id_manual, away_team_id_manual"),
    admin.from("tournament_state").select("*").eq("id", true).maybeSingle(),
  ]);

  if (!groups || !sview || !matches) return { ok: false, error: "Greška čitanja podataka" };

  // Group letter map
  const letterByGroupId = new Map<string, string>();
  (groups as any[]).forEach((g) => {
    const m = g.name.match(/Grupa\s+([A-Z])/i);
    letterByGroupId.set(g.id, m ? m[1].toUpperCase() : g.name.slice(-1).toUpperCase());
  });

  // h2h points (via DB function)
  const h2hCache = new Map<string, number>();
  async function h2h(a: string, b: string): Promise<number> {
    const key = `${a}|${b}`;
    if (h2hCache.has(key)) return h2hCache.get(key)!;
    const { data } = await admin.rpc("h2h_points" as any, { p_team_a: a, p_team_b: b });
    const v = typeof data === "number" ? data : 0;
    h2hCache.set(key, v);
    return v;
  }

  // Pre-fetch all h2h pairs we might need
  const rowsByGroup = new Map<string, StandingsRowWithDiscipline[]>();
  for (const row of sview as any[]) {
    if (!row.group_id) continue;
    const arr = rowsByGroup.get(row.group_id) ?? [];
    arr.push({
      team_id: row.team_id,
      group_id: row.group_id,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goals_for: row.goals_for,
      goals_against: row.goals_against,
      goal_diff: row.goal_diff,
      points: row.points,
      ppg: Number(row.ppg),
      discipline_points: row.discipline_points,
    });
    rowsByGroup.set(row.group_id, arr);
  }

  // h2h pre-fetch (each pair once)
  for (const [, rows] of rowsByGroup) {
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        await h2h(rows[i].team_id, rows[j].team_id);
        await h2h(rows[j].team_id, rows[i].team_id);
      }
    }
  }
  const h2hSync = (a: string, b: string) => h2hCache.get(`${a}|${b}`) ?? 0;

  // Sort within each group, also include teams with zero matches (they should appear)
  const { data: gtAll } = await admin.from("group_teams").select("group_id, team_id");
  for (const gt of ((gtAll ?? []) as any[])) {
    const arr = rowsByGroup.get(gt.group_id) ?? [];
    if (!arr.find((r) => r.team_id === gt.team_id)) {
      arr.push({
        team_id: gt.team_id, group_id: gt.group_id,
        played: 0, wins: 0, draws: 0, losses: 0,
        goals_for: 0, goals_against: 0, goal_diff: 0, points: 0,
        ppg: 0, discipline_points: 0,
      });
      rowsByGroup.set(gt.group_id, arr);
    }
  }

  const byGroupLetter = new Map<string, Array<{ team_id: string }>>();
  for (const [gid, rows] of rowsByGroup) {
    const letter = letterByGroupId.get(gid);
    if (!letter) continue;
    const sorted = sortGroupStandings(rows, h2hSync);
    byGroupLetter.set(letter, sorted.map((r) => ({ team_id: r.team_id })));
  }

  // Best thirds across all groups: rank by PPG/etc among each group's 3rd-placed team
  const thirdPlaceRows: StandingsRowWithDiscipline[] = [];
  for (const [, rows] of rowsByGroup) {
    const sorted = sortGroupStandings(rows, h2hSync);
    if (sorted[2]) thirdPlaceRows.push(sorted[2]);
  }
  const bestThirds = rankCrossGroup(thirdPlaceRows).map((r) => r.team_id);

  // Knockout winners/losers
  const { data: koMatches } = await admin
    .from("matches")
    .select("bracket_position, home_team_id, away_team_id, home_score, away_score, phase, knockout_winner_id, round:rounds(stage)")
    .not("bracket_position", "is", null);
  const winners = new Map<string, string>();
  const losers = new Map<string, string>();
  for (const m of (koMatches ?? []) as any[]) {
    if (m.round?.stage !== "knockout") continue;
    if (m.phase !== "finished") continue;
    let winnerId: string | null = m.knockout_winner_id;
    if (!winnerId) {
      if (m.home_score > m.away_score) winnerId = m.home_team_id;
      else if (m.away_score > m.home_score) winnerId = m.away_team_id;
    }
    if (!winnerId) continue;
    winners.set(m.bracket_position, winnerId);
    const loserId = winnerId === m.home_team_id ? m.away_team_id : m.home_team_id;
    if (loserId) losers.set(m.bracket_position, loserId);
  }

  // Apply resolution to each knockout match
  for (const m of (matches as any[])) {
    const updates: any = {};
    // Home slot: manual override wins; else resolve placeholder
    if (m.home_team_id_manual) {
      updates.home_team_id = m.home_team_id_manual;
    } else if (m.home_placeholder) {
      const t = resolvePlaceholder(m.home_placeholder, byGroupLetter, bestThirds, winners, losers);
      if (t !== null) updates.home_team_id = t;
    }
    if (m.away_team_id_manual) {
      updates.away_team_id = m.away_team_id_manual;
    } else if (m.away_placeholder) {
      const t = resolvePlaceholder(m.away_placeholder, byGroupLetter, bestThirds, winners, losers);
      if (t !== null) updates.away_team_id = t;
    }
    if (Object.keys(updates).length) {
      await admin.from("matches").update(updates).eq("id", m.id);
    }
  }

  return { ok: true };
}
