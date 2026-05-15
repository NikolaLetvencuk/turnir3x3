export type BracketSlot = string; // placeholder string

export type BracketMatch = {
  bracket_position: string; // 'R16_1','QF_1','SF_1','F','TP'
  round_index: number; // 0 = first knockout round, increments to final
  round_name: string;
  home: BracketSlot;
  away: BracketSlot;
};

const ROUND_NAMES_BY_SIZE: Record<number, string[]> = {
  16: ["Osmina finala", "Četvrtfinale", "Polufinale", "Finale"],
  8: ["Četvrtfinale", "Polufinale", "Finale"],
  4: ["Polufinale", "Finale"],
  2: ["Finale"],
};

const POS_PREFIX_BY_ROUND_AND_SIZE: Record<number, string[]> = {
  16: ["R16", "QF", "SF", "F"],
  8: ["QF", "SF", "F"],
  4: ["SF", "F"],
  2: ["F"],
};

/**
 * Build initial seeding for the first knockout round.
 * Strategy: walk slots so that 1-seeds meet 2-seeds from different groups when possible.
 * For 4 advancing (2 groups × 2): A1-B2, B1-A2
 * For 8 advancing (4 groups × 2): A1-B2, C1-D2, B1-A2, D1-C2
 * For 8 advancing (2 groups × 4): A1-B4, A3-B2, A2-B3, A4-B1
 */
export function pairBracketSlots(slots: BracketSlot[]): Array<[BracketSlot, BracketSlot]> {
  const n = slots.length;
  if (n < 2 || (n & (n - 1)) !== 0) throw new Error("Slot count must be power of 2");
  const pairs: Array<[BracketSlot, BracketSlot]> = [];
  for (let i = 0; i < n / 2; i++) {
    pairs.push([slots[i], slots[n - 1 - i]]);
  }
  return pairs;
}

export type BracketConfig = {
  groupLetters: string[];
  advancingPerGroup: number;
  bestThirds: number;
  includeThirdPlace?: boolean;
};

export function generateBracket(cfg: BracketConfig): BracketMatch[] {
  const totalAdvancing = cfg.groupLetters.length * cfg.advancingPerGroup + cfg.bestThirds;
  if (![2, 4, 8, 16].includes(totalAdvancing)) {
    throw new Error("Ukupno timova koji prolaze mora biti 2, 4, 8 ili 16");
  }
  const includeThirdPlace = cfg.includeThirdPlace !== false && totalAdvancing >= 4;

  // Build initial slots: A1, B1, ..., A2, B2, ..., BEST3_1, ...
  const slots: BracketSlot[] = [];
  for (let pos = 1; pos <= cfg.advancingPerGroup; pos++) {
    for (const g of cfg.groupLetters) {
      slots.push(`${g}${pos}`);
    }
  }
  for (let i = 1; i <= cfg.bestThirds; i++) {
    slots.push(`BEST3_${i}`);
  }

  if (slots.length !== totalAdvancing) {
    throw new Error("Greška u rasporedu slot-ova");
  }

  const matches: BracketMatch[] = [];
  const positions = POS_PREFIX_BY_ROUND_AND_SIZE[totalAdvancing];
  const roundNames = ROUND_NAMES_BY_SIZE[totalAdvancing];
  if (!positions || !roundNames) throw new Error("Nepodržana veličina nokauta");

  // Round 0: pair initial slots
  let currentRoundSlots = slots.slice();
  let roundIndex = 0;
  let prevMatchPositions: string[] = [];

  while (currentRoundSlots.length >= 2) {
    const pos = positions[roundIndex];
    const pairs = pairBracketSlots(currentRoundSlots);
    const positionLabels: string[] = [];

    pairs.forEach((pair, i) => {
      const matchPos = pairs.length === 1 ? pos : `${pos}_${i + 1}`;
      positionLabels.push(matchPos);
      matches.push({
        bracket_position: matchPos,
        round_index: roundIndex,
        round_name: roundNames[roundIndex],
        home: pair[0],
        away: pair[1],
      });
    });

    prevMatchPositions = positionLabels;
    // Next round's slots are W_<position>
    currentRoundSlots = positionLabels.map((p) => `W_${p}`);
    roundIndex++;
  }

  // Third place playoff between losers of semifinals (round_index = roundIndex - 2)
  if (includeThirdPlace) {
    const sfRoundIdx = roundIndex - 2;
    if (sfRoundIdx >= 0) {
      const sfMatches = matches.filter((m) => m.round_index === sfRoundIdx);
      if (sfMatches.length === 2) {
        matches.push({
          bracket_position: "TP",
          round_index: roundIndex - 1, // same as final
          round_name: "Meč za 3. mesto",
          home: `L_${sfMatches[0].bracket_position}`,
          away: `L_${sfMatches[1].bracket_position}`,
        });
      }
    }
  }

  return matches;
}

/**
 * Resolve a placeholder string against group standings and previous knockout results.
 * Returns team_id or null if not resolvable yet.
 */
export type StandingsByGroup = Map<string, Array<{ team_id: string }>>; // group_letter → ranked teams
export type BestThirdsRanking = string[]; // team_ids in order

export function resolvePlaceholder(
  placeholder: string,
  byGroup: StandingsByGroup,
  bestThirds: BestThirdsRanking,
  knockoutWinners: Map<string, string>, // bracket_position → winner team_id
  knockoutLosers: Map<string, string>, // bracket_position → loser team_id
): string | null {
  // Group position: A1, B2, etc.
  const groupMatch = placeholder.match(/^([A-H])(\d+)$/);
  if (groupMatch) {
    const letter = groupMatch[1];
    const pos = parseInt(groupMatch[2], 10);
    const ranked = byGroup.get(letter);
    if (!ranked) return null;
    return ranked[pos - 1]?.team_id ?? null;
  }
  // Best third: BEST3_1, BEST3_2
  const best = placeholder.match(/^BEST3_(\d+)$/);
  if (best) {
    const idx = parseInt(best[1], 10);
    return bestThirds[idx - 1] ?? null;
  }
  // Knockout winner: W_QF_1, W_SF_2, W_R16_3, W_F
  const win = placeholder.match(/^W_(.+)$/);
  if (win) return knockoutWinners.get(win[1]) ?? null;
  // Knockout loser: L_SF_1
  const loss = placeholder.match(/^L_(.+)$/);
  if (loss) return knockoutLosers.get(loss[1]) ?? null;
  return null;
}
