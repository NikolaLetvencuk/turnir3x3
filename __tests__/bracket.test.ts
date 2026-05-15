import { describe, it, expect } from "vitest";
import { generateBracket, pairBracketSlots, resolvePlaceholder } from "@/lib/bracket";

describe("pairBracketSlots", () => {
  it("pairs 4 slots correctly", () => {
    const pairs = pairBracketSlots(["A1", "B1", "A2", "B2"]);
    expect(pairs).toEqual([["A1", "B2"], ["B1", "A2"]]);
  });
  it("throws on non-power-of-2", () => {
    expect(() => pairBracketSlots(["A1", "B1", "C1"])).toThrow();
  });
});

describe("generateBracket", () => {
  it("2 teams → final only", () => {
    const m = generateBracket({ groupLetters: ["A"], advancingPerGroup: 2, bestThirds: 0, includeThirdPlace: false });
    expect(m).toHaveLength(1);
    expect(m[0].bracket_position).toBe("F");
    expect(m[0].round_name).toBe("Finale");
  });
  it("4 teams (2 groups × 2) → 2 SF + 1 F + 1 TP", () => {
    const m = generateBracket({ groupLetters: ["A", "B"], advancingPerGroup: 2, bestThirds: 0 });
    expect(m).toHaveLength(4); // 2 SF + F + TP
    const positions = m.map((x) => x.bracket_position).sort();
    expect(positions).toEqual(["F", "SF_1", "SF_2", "TP"]);
    // Verify SF placeholders
    const sf1 = m.find((x) => x.bracket_position === "SF_1")!;
    expect([sf1.home, sf1.away].sort()).toEqual(["A1", "B2"].sort());
  });
  it("8 teams (4 groups × 2) → 4 QF + 2 SF + F + TP", () => {
    const m = generateBracket({ groupLetters: ["A", "B", "C", "D"], advancingPerGroup: 2, bestThirds: 0 });
    expect(m).toHaveLength(8);
    expect(m.filter((x) => x.bracket_position.startsWith("QF"))).toHaveLength(4);
    expect(m.filter((x) => x.bracket_position.startsWith("SF"))).toHaveLength(2);
    expect(m.filter((x) => x.bracket_position === "F")).toHaveLength(1);
    expect(m.filter((x) => x.bracket_position === "TP")).toHaveLength(1);
  });
  it("8 teams (2 groups × 4) works", () => {
    const m = generateBracket({ groupLetters: ["A", "B"], advancingPerGroup: 4, bestThirds: 0 });
    expect(m).toHaveLength(8);
  });
  it("6 teams advancing (4 groups × 1 + 2 best thirds) → 4 advancing scenario", () => {
    // 4 groups * 1 + 0 = 4 total → 2 SF + F + TP
    const m = generateBracket({ groupLetters: ["A", "B", "C", "D"], advancingPerGroup: 1, bestThirds: 0 });
    expect(m).toHaveLength(4);
  });
  it("rejects total advancing != power of 2", () => {
    expect(() => generateBracket({ groupLetters: ["A", "B", "C"], advancingPerGroup: 2, bestThirds: 0 })).toThrow();
  });
  it("SF feeds into F via W_SF_x placeholders", () => {
    const m = generateBracket({ groupLetters: ["A", "B"], advancingPerGroup: 2, bestThirds: 0 });
    const f = m.find((x) => x.bracket_position === "F")!;
    expect([f.home, f.away].sort()).toEqual(["W_SF_1", "W_SF_2"].sort());
    const tp = m.find((x) => x.bracket_position === "TP")!;
    expect([tp.home, tp.away].sort()).toEqual(["L_SF_1", "L_SF_2"].sort());
  });
});

describe("resolvePlaceholder", () => {
  const byGroup = new Map([
    ["A", [{ team_id: "team_a1" }, { team_id: "team_a2" }, { team_id: "team_a3" }]],
    ["B", [{ team_id: "team_b1" }, { team_id: "team_b2" }]],
  ]);
  const bestThirds = ["team_x", "team_y"];
  const winners = new Map([["QF_1", "team_qf1_win"]]);
  const losers = new Map([["SF_1", "team_sf1_loss"]]);

  it("resolves A1 → team_a1", () => {
    expect(resolvePlaceholder("A1", byGroup, bestThirds, winners, losers)).toBe("team_a1");
  });
  it("resolves BEST3_2 → team_y", () => {
    expect(resolvePlaceholder("BEST3_2", byGroup, bestThirds, winners, losers)).toBe("team_y");
  });
  it("resolves W_QF_1", () => {
    expect(resolvePlaceholder("W_QF_1", byGroup, bestThirds, winners, losers)).toBe("team_qf1_win");
  });
  it("resolves L_SF_1", () => {
    expect(resolvePlaceholder("L_SF_1", byGroup, bestThirds, winners, losers)).toBe("team_sf1_loss");
  });
  it("returns null for unresolvable", () => {
    expect(resolvePlaceholder("W_F", byGroup, bestThirds, winners, losers)).toBeNull();
    expect(resolvePlaceholder("C1", byGroup, bestThirds, winners, losers)).toBeNull();
  });
});
