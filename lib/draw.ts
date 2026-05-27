export type DrawTeam = { id: string; name: string; short_name: string | null; primary_color: string | null; secondary_color: string | null; logo_url?: string | null };
export type Fixture<T> = { round: number; home: T; away: T };

export function distributeTeams<T>(teams: T[], groupCount: number): T[][] {
  if (groupCount < 1) throw new Error("groupCount must be ≥ 1");
  if (teams.length < groupCount) throw new Error("Not enough teams for that many groups");

  const shuffled = [...teams];
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

export function generateRoundRobin<T>(teams: T[]): Fixture<T>[] {
  if (teams.length < 2) return [];
  if (teams.length === 2) return [{ round: 1, home: teams[0], away: teams[1] }];

  const ts: (T | null)[] = [...teams];
  if (ts.length % 2 === 1) ts.push(null);

  const n = ts.length;
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;
  const fixtures: Fixture<T>[] = [];

  for (let r = 0; r < totalRounds; r++) {
    for (let i = 0; i < matchesPerRound; i++) {
      const home = ts[i];
      const away = ts[n - 1 - i];
      if (home !== null && away !== null) {
        if (r % 2 === 0) fixtures.push({ round: r + 1, home, away });
        else fixtures.push({ round: r + 1, home: away, away: home });
      }
    }
    const last = ts.pop()!;
    ts.splice(1, 0, last);
  }
  return fixtures;
}

export type DrawResult = {
  groups: Array<{ name: string; letter: string; teams: DrawTeam[] }>;
  rounds: Array<{ name: string; matches: Array<{ group_index: number; home: DrawTeam; away: DrawTeam }> }>;
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Build round-robin fixtures + kola from pre-composed groups (no random distribution).
 * Used by manual draw mode where admin assigns teams to groups.
 */
export function composeDraw(buckets: DrawTeam[][]): DrawResult {
  const groups = buckets.map((b, i) => ({
    name: `Grupa ${ALPHABET[i] ?? String(i + 1)}`,
    letter: ALPHABET[i] ?? String(i + 1),
    teams: b,
  }));

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

export function computeDraw(teams: DrawTeam[], groupCount: number): DrawResult {
  if (teams.length < groupCount * 2) {
    throw new Error(`Potrebno je najmanje ${groupCount * 2} timova za ${groupCount} grupa`);
  }
  return composeDraw(distributeTeams(teams, groupCount));
}
