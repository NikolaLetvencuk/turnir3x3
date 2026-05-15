export type StandingsRowWithDiscipline = {
  team_id: string;
  group_id: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  ppg: number;
  discipline_points: number;
};

/**
 * Sort teams within a single group. Tiebreakers:
 * 1. points desc
 * 2. goal_diff desc
 * 3. goals_for desc
 * 4. head-to-head points desc (computed externally and passed in)
 * 5. discipline_points asc (fewer cards better)
 * 6. team_id asc (deterministic fallback)
 */
export function sortGroupStandings(
  rows: StandingsRowWithDiscipline[],
  h2h?: (teamA: string, teamB: string) => number,
): StandingsRowWithDiscipline[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    if (h2h) {
      const ah = h2h(a.team_id, b.team_id);
      const bh = h2h(b.team_id, a.team_id);
      if (bh !== ah) return bh - ah;
    }
    if (a.discipline_points !== b.discipline_points) return a.discipline_points - b.discipline_points;
    return a.team_id.localeCompare(b.team_id);
  });
  return sorted;
}

/**
 * Rank the N-th placed teams across all groups for best-thirds selection.
 * Uses PPG to normalize uneven group sizes.
 */
export function rankCrossGroup(
  rows: StandingsRowWithDiscipline[],
): StandingsRowWithDiscipline[] {
  return [...rows].sort((a, b) => {
    if (b.ppg !== a.ppg) return b.ppg - a.ppg;
    const aGdPerGame = a.played > 0 ? a.goal_diff / a.played : 0;
    const bGdPerGame = b.played > 0 ? b.goal_diff / b.played : 0;
    if (bGdPerGame !== aGdPerGame) return bGdPerGame - aGdPerGame;
    const aGfPerGame = a.played > 0 ? a.goals_for / a.played : 0;
    const bGfPerGame = b.played > 0 ? b.goals_for / b.played : 0;
    if (bGfPerGame !== aGfPerGame) return bGfPerGame - aGfPerGame;
    if (a.discipline_points !== b.discipline_points) return a.discipline_points - b.discipline_points;
    return a.team_id.localeCompare(b.team_id);
  });
}
