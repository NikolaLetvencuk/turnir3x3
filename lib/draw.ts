export type DrawTeam = { id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null };

export function distributeTeams<T>(teams: T[], groupCount: number): T[][] {
  if (groupCount < 1) throw new Error("Group count must be >= 1");
  const shuffled = [...teams];
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  shuffled.forEach((team, i) => {
    const row = Math.floor(i / groupCount);
    const col = i % groupCount;
    const idx = row % 2 === 0 ? col : groupCount - 1 - col;
    groups[idx].push(team);
  });
  return groups;
}

export type Fixture<T> = { round: number; home: T; away: T };

export function generateRoundRobin<T>(teams: T[]): Fixture<T>[] {
  if (teams.length < 2) return [];
  const ts: (T | null)[] = [...teams];
  if (ts.length % 2 === 1) ts.push(null);
  const n = ts.length;
  const rounds = n - 1;
  const out: Fixture<T>[] = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = ts[i];
      const away = ts[n - 1 - i];
      if (home && away) {
        // Alternate home/away by round for fairness
        if (r % 2 === 0) out.push({ round: r + 1, home, away });
        else out.push({ round: r + 1, home: away, away: home });
      }
    }
    // Rotate: keep ts[0] fixed
    const last = ts.pop()!;
    ts.splice(1, 0, last);
  }
  return out;
}

export type DrawResult = {
  groups: Array<{ name: string; teams: DrawTeam[] }>;
  rounds: Array<{ name: string; matches: Array<{ group_index: number; home: DrawTeam; away: DrawTeam }> }>;
};

export function computeDraw(teams: DrawTeam[], groupCount: number): DrawResult {
  const buckets = distributeTeams(teams, groupCount);
  const groupLabels = "ABCDEFGH".slice(0, groupCount).split("");
  const groups = buckets.map((b, i) => ({ name: `Grupa ${groupLabels[i] ?? i + 1}`, teams: b }));

  // Per-group fixtures
  const perGroup = buckets.map((b) => generateRoundRobin(b));
  const maxRounds = Math.max(0, ...perGroup.map((p) => p.reduce((max, f) => Math.max(max, f.round), 0)));
  const rounds: DrawResult["rounds"] = [];
  for (let r = 1; r <= maxRounds; r++) {
    const matches: DrawResult["rounds"][number]["matches"] = [];
    perGroup.forEach((fixtures, gi) => {
      fixtures.filter((f) => f.round === r).forEach((f) => matches.push({ group_index: gi, home: f.home, away: f.away }));
    });
    rounds.push({ name: `Kolo ${r}`, matches });
  }
  return { groups, rounds };
}
