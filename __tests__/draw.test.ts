import { describe, it, expect } from "vitest";
import { computeDraw, distributeTeams, generateRoundRobin, type DrawTeam } from "@/lib/draw";

function mkTeam(i: number): DrawTeam {
  return { id: `t${i}`, name: `Team ${i}`, short_name: null, primary_color: null, secondary_color: null };
}
function mkTeams(n: number) { return Array.from({ length: n }, (_, i) => mkTeam(i + 1)); }

function expectValidDraw(teamCount: number, groupCount: number) {
  const teams = mkTeams(teamCount);
  const result = computeDraw(teams, groupCount);

  // total teams preserved
  const allTeamsInGroups = result.groups.flatMap((g) => g.teams);
  expect(allTeamsInGroups).toHaveLength(teamCount);

  // every team appears exactly once
  const ids = allTeamsInGroups.map((t) => t.id).sort();
  const expected = teams.map((t) => t.id).sort();
  expect(ids).toEqual(expected);

  // groupCount correct
  expect(result.groups).toHaveLength(groupCount);

  // each pair within a group meets exactly once
  for (const g of result.groups) {
    const seen = new Set<string>();
    const groupMatches = result.rounds.flatMap((r) => r.matches.filter((m) => result.groups[m.group_index] === g));
    // expected match count = n*(n-1)/2
    expect(groupMatches).toHaveLength(g.teams.length * (g.teams.length - 1) / 2);
    for (const m of groupMatches) {
      const k = [m.home.id, m.away.id].sort().join("|");
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      expect(m.home.id).not.toBe(m.away.id);
    }
  }

  // round indices valid
  const maxGroupRounds = Math.max(0, ...result.groups.map((g) => g.teams.length % 2 === 0 ? Math.max(0, g.teams.length - 1) : g.teams.length));
  expect(result.rounds.length).toBeLessThanOrEqual(Math.max(0, maxGroupRounds));
  for (const r of result.rounds) {
    for (const m of r.matches) {
      expect(typeof m.group_index).toBe("number");
    }
  }
}

describe("distributeTeams", () => {
  it("throws when groupCount < 1", () => {
    expect(() => distributeTeams([mkTeam(1)], 0)).toThrow();
  });
  it("throws when teams < groupCount", () => {
    expect(() => distributeTeams([mkTeam(1)], 2)).toThrow();
  });
  it("balances 6 into 2 groups", () => {
    const g = distributeTeams(mkTeams(6), 2);
    expect(g).toHaveLength(2);
    expect(g[0].length + g[1].length).toBe(6);
    expect(Math.abs(g[0].length - g[1].length)).toBeLessThanOrEqual(1);
  });
});

describe("generateRoundRobin", () => {
  it("returns empty for < 2 teams", () => {
    expect(generateRoundRobin([])).toEqual([]);
    expect(generateRoundRobin([mkTeam(1)])).toEqual([]);
  });
  it("returns one fixture for exactly 2 teams", () => {
    const f = generateRoundRobin([mkTeam(1), mkTeam(2)]);
    expect(f).toHaveLength(1);
    expect(f[0].round).toBe(1);
  });
  it("returns 3 fixtures (3 rounds) for 3 teams", () => {
    const f = generateRoundRobin(mkTeams(3));
    expect(f).toHaveLength(3);
  });
  it("returns 6 fixtures (3 rounds) for 4 teams", () => {
    const f = generateRoundRobin(mkTeams(4));
    expect(f).toHaveLength(6);
    const rounds = new Set(f.map((x) => x.round));
    expect(rounds.size).toBe(3);
  });
});

describe("computeDraw — all required scenarios", () => {
  it("2 teams, 1 group", () => expectValidDraw(2, 1));
  it("4 teams, 2 groups", () => expectValidDraw(4, 2));
  it("6 teams, 2 groups", () => expectValidDraw(6, 2));
  it("6 teams, 3 groups", () => expectValidDraw(6, 3));
  it("8 teams, 2 groups", () => expectValidDraw(8, 2));
  it("9 teams, 3 groups", () => expectValidDraw(9, 3));
  it("10 teams, 3 groups (uneven 4+3+3)", () => expectValidDraw(10, 3));
  it("7 teams, 2 groups (uneven 4+3)", () => expectValidDraw(7, 2));

  it("4+2: produces exactly 2 fixtures in 1 kolo", () => {
    const r = computeDraw(mkTeams(4), 2);
    const totalMatches = r.rounds.reduce((acc, rd) => acc + rd.matches.length, 0);
    expect(totalMatches).toBe(2);
    expect(r.rounds).toHaveLength(1);
  });

  it("throws when teams < groupCount * 2", () => {
    expect(() => computeDraw(mkTeams(3), 2)).toThrow();
    expect(() => computeDraw(mkTeams(1), 1)).toThrow();
  });
});
