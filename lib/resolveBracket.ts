import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { crossGroupTieBuckets, rankCrossGroup, sortGroupStandings, type StandingsRowWithDiscipline } from "@/lib/groupSorting";
import { resolvePlaceholder } from "@/lib/bracket";

export type WildcardCandidate = {
  team_id: string;
  team_name: string;
  group_letter: string;
  played: number;
  points: number;
  goal_diff: number;
  goals_for: number;
  goals_against: number;
  ppg: number;
  selected: boolean;
};

export type WildcardReport = {
  rankIndex: number; // 0-based: 1 = best second, 2 = best third, ...
  rankLabel: string; // "drugoplasiranih" / "trećeplasiranih" / "X-toplasiranih"
  needed: number; // how many slots
  candidates: WildcardCandidate[];
  /** Buckets that are still tied after every objective tiebreaker. Only buckets
   *  that overlap the cutoff (i.e. would actually decide who advances) matter. */
  contestedTies: WildcardCandidate[][];
  /** Groups whose roster is too small to supply a team at the wildcard rank. */
  missingGroups: string[];
};

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

  // Letters by display order — must match generateKnockoutBracket so
  // placeholders like "I1" always line up with the 9th group regardless of
  // how the group is named.
  const letterByGroupId = new Map<string, string>();
  (groups as any[]).forEach((g, i) => {
    letterByGroupId.set(g.id, String.fromCharCode(65 + i));
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

  // Wildcards: rank teams at the position immediately *after* the direct
  // qualifiers across every group. If advancing_per_group is 1 (one team out
  // of each group goes through directly) we pull the best 2nd-placed teams; if
  // it's 2, we pull the best 3rd-placed; etc. Falls back to "best 3rd-placed"
  // when the config isn't saved yet so older flows keep working.
  const advancingPerGroup = (ts as any)?.advancing_per_group ?? 2;
  const wildcardRankIndex = Math.max(1, advancingPerGroup); // 0-indexed slot to take from each group
  const wildcardRows: StandingsRowWithDiscipline[] = [];
  for (const [, rows] of rowsByGroup) {
    const sorted = sortGroupStandings(rows, h2hSync);
    if (sorted[wildcardRankIndex]) wildcardRows.push(sorted[wildcardRankIndex]);
  }
  const bestThirds = rankCrossGroup(wildcardRows).map((r) => r.team_id);

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

const ORDINAL_LABEL: Record<number, string> = {
  1: "drugoplasiranih",
  2: "trećeplasiranih",
  3: "četvrtoplasiranih",
  4: "petoplasiranih",
  5: "šestoplasiranih",
  6: "sedmoplasiranih",
  7: "osmoplasiranih",
};

/**
 * Compute the wildcard pool for the current tournament configuration.
 * Surfaces the ordered candidate list, which ones would be selected for the
 * given slot count, and which buckets are still tied past every objective
 * tiebreaker so the admin can decide manually or schedule a playoff.
 */
export async function getWildcardReport(
  needed: number,
  advancingPerGroup: number,
): Promise<WildcardReport> {
  const admin = createAdminClient();

  const [{ data: groups }, { data: sview }, { data: teams }, { data: gtAll }] = await Promise.all([
    admin.from("groups").select("id, name").order("display_order"),
    admin.from("standings").select("*"),
    admin.from("teams").select("id, name"),
    admin.from("group_teams").select("group_id, team_id"),
  ]);

  const letterByGroupId = new Map<string, string>();
  (groups ?? []).forEach((g: any, i: number) => {
    letterByGroupId.set(g.id, String.fromCharCode(65 + i));
  });
  const nameByTeam = new Map<string, string>(((teams ?? []) as any[]).map((t) => [t.id, t.name]));

  const rowsByGroup = new Map<string, StandingsRowWithDiscipline[]>();
  for (const row of (sview ?? []) as any[]) {
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

  const rankIndex = Math.max(1, advancingPerGroup);
  const pool: StandingsRowWithDiscipline[] = [];
  const missingGroups: string[] = [];
  for (const [gid, rows] of rowsByGroup) {
    const sorted = sortGroupStandings(rows);
    const row = sorted[rankIndex];
    if (row) pool.push(row);
    else missingGroups.push(letterByGroupId.get(gid) ?? "?");
  }

  const ranked = rankCrossGroup(pool);
  const buckets = crossGroupTieBuckets(ranked);

  const selectedIds = new Set(ranked.slice(0, needed).map((r) => r.team_id));
  const candidates: WildcardCandidate[] = ranked.map((r) => ({
    team_id: r.team_id,
    team_name: nameByTeam.get(r.team_id) ?? "?",
    group_letter: letterByGroupId.get(r.group_id ?? "") ?? "?",
    played: r.played,
    points: r.points,
    goal_diff: r.goal_diff,
    goals_for: r.goals_for,
    goals_against: r.goals_against,
    ppg: r.ppg,
    selected: selectedIds.has(r.team_id),
  }));

  // A bucket "contests" the cutoff if it has more members than free wildcard
  // slots at the bucket's starting position — i.e. choosing the deterministic
  // tiebreaker would actually decide who advances.
  const contested: WildcardCandidate[][] = [];
  let pos = 0;
  for (const bucket of buckets) {
    const startsInside = pos < needed;
    const endsInside = pos + bucket.length <= needed;
    if (startsInside && !endsInside && bucket.length > 1) {
      contested.push(
        bucket.map((r) => ({
          team_id: r.team_id,
          team_name: nameByTeam.get(r.team_id) ?? "?",
          group_letter: letterByGroupId.get(r.group_id ?? "") ?? "?",
          played: r.played,
          points: r.points,
          goal_diff: r.goal_diff,
          goals_for: r.goals_for,
          goals_against: r.goals_against,
          ppg: r.ppg,
          selected: selectedIds.has(r.team_id),
        })),
      );
    }
    pos += bucket.length;
  }

  return {
    rankIndex,
    rankLabel: ORDINAL_LABEL[rankIndex] ?? `${rankIndex + 1}-toplasiranih`,
    needed,
    candidates,
    contestedTies: contested,
    missingGroups,
  };
}
