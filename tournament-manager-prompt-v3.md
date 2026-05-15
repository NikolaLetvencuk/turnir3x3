# Tournament Manager — Iteration 3 (Knockout System + Draw Fixes)

You are modifying the existing Tournament Manager project. Read `.env.local`, work in the existing project root.

Create branch: `git checkout -b iter3-knockout-system`

---

## 1. Summary of changes

1. **Remove `players.position`** — this tournament has no position concept
2. **Verify player photo upload works at all tournament stages** — including after the draw, during group stage, during knockout
3. **Fix the broken draw with 4 teams + 2 groups** — currently crashes after placing 3 teams; must work for any valid (teams, groupCount) combination
4. **Configurable knockout advancement** — admin chooses how many teams advance
5. **Knockout bracket with placeholders** — bracket can be generated at any time (even before group stage starts), populated with `A1`, `B2`, `W_QF1` style placeholders
6. **Placeholder resolution** — when admin locks group stage, placeholders resolve to actual teams; when a knockout match finishes, winner/loser placeholders resolve in the next round
7. **Fair handling of uneven groups** — when group sizes differ, cross-group ranking uses points-per-game (PPG); admin can always override
8. **Manual override everywhere** — every bracket slot is editable; admin can swap teams, change kickoff times, reorder matches

---

## 2. Detailed specifications

### 2.1 Remove `players.position`

**Migration** (`supabase/migrations/0008_drop_player_position.sql`):
```sql
alter table players drop column if exists position;
```

Remove `position` from:
- All TypeScript types (regenerate `types/database.ts` after migration)
- Zod schemas for player create/edit
- Admin player forms (`/admin/players`)
- Public player display (`/players`, `/players/[id]`)
- Any sorting/filtering by position

### 2.2 Player photo upload at all stages

**Verify and ensure:**
- `/admin/players` is accessible regardless of tournament state (draw done, group stage active, knockout active)
- Photo upload form on player edit modal works for existing players (UPDATE flow)
- Photos are not locked by any tournament status
- New players can be added at any time (substitution scenarios)
- Deleting a player with photo also removes the photo from Storage

If any of this is currently blocked by a status check, remove the block.

### 2.3 Fix the draw bug (4 teams + 2 groups)

**Current symptom:** with 4 teams and 2 groups, the draw animation places team 1 in group A, then teams 2 and 3 in group B, then errors out before placing team 4.

**Required fix:**
1. Add unit tests to `__tests__/draw.test.ts` covering:
   - 2 teams, 1 group (1 group with 2 teams, 1 fixture per group, 1 kolo)
   - 4 teams, 2 groups (2 teams per group, 1 fixture per group, 1 kolo total)
   - 6 teams, 2 groups (3 per group, 3 fixtures per group, 3 kola)
   - 6 teams, 3 groups (2 per group, 1 fixture per group, 1 kolo)
   - 8 teams, 2 groups
   - 9 teams, 3 groups (3 per group)
   - 10 teams, 3 groups (uneven: 4+3+3)
   - 7 teams, 2 groups (uneven: 4+3)

2. Each test must verify:
   - Distribution: total teams in groups equals input team count
   - No duplicates: each team appears in exactly one group
   - Round-robin: each pair within a group meets exactly once
   - Kola assignment: every match has a `round` index, max round equals max(groupRounds)

3. Fix the actual algorithm. Suspected causes:
   - Animation may iterate based on a length mismatch (e.g., assumes one team per group per "slot" position)
   - `generateRoundRobin` for n=2 may have a rotation issue
   - The animation's per-team timing may exceed the array length
   - Commit step may insert duplicate `group_teams` (violating unique constraint)
   - `matches` insert may fail when `home_team_id === away_team_id` due to a bug in fixture generation

4. **Critical correctness for the animation:**
   - Compute the full draw result FIRST (groups + fixtures), store in component state
   - Then animate based on the stored result — never animate "live" with computed-on-the-fly state
   - Animation duration scales with team count: ~0.6s per team draw + 1.5s opening/closing = `0.6 * teamCount + 3` seconds total
   - "Preskoči" button immediately renders the final committed state

5. **Edge case handling in `generateRoundRobin`:**
   ```typescript
   export function generateRoundRobin<T>(teams: T[]): Array<{ round: number; home: T; away: T }> {
     if (teams.length < 2) return [];
     if (teams.length === 2) return [{ round: 1, home: teams[0], away: teams[1] }];
     
     const ts: (T | null)[] = [...teams];
     if (ts.length % 2 === 1) ts.push(null); // bye placeholder
     
     const n = ts.length;
     const totalRounds = n - 1;
     const matchesPerRound = n / 2;
     const fixtures: Array<{ round: number; home: T; away: T }> = [];
     
     for (let r = 0; r < totalRounds; r++) {
       for (let i = 0; i < matchesPerRound; i++) {
         const home = ts[i];
         const away = ts[n - 1 - i];
         if (home !== null && away !== null) {
           fixtures.push({ round: r + 1, home, away });
         }
       }
       // Rotate: keep ts[0] fixed, others rotate clockwise
       const last = ts.pop()!;
       ts.splice(1, 0, last);
     }
     return fixtures;
   }
   ```

6. **Edge case in `distributeTeams`:**
   ```typescript
   export function distributeTeams<T>(teams: T[], groupCount: number): T[][] {
     if (groupCount < 1) throw new Error('groupCount must be ≥ 1');
     if (teams.length < groupCount) throw new Error('Not enough teams for that many groups');
     
     const shuffled = [...teams];
     // Fisher-Yates
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
   ```

7. **Validation before draw runs:**
   - teams.length >= groupCount * 2 (need at least 2 per group for any round-robin)
   - Show clear error if not met: "Potrebno je najmanje X timova za Y grupa"

### 2.4 Configurable knockout advancement

Add to `/admin/bracket`:
- Input: **"Broj timova koji prolazi u nokaut fazu"** (must be one of: 2, 4, 8, 16)
- Validation: total advancing must be ≤ total teams
- Validation: total advancing must be a power of 2 (the bracket size)
- Input: **"Timova po grupi koji direktno prolazi"** (default: floor(advancing / groupCount))
- Remainder slots filled by best-PPG teams across all groups

Example: 8 teams advance, 4 groups → 2 per group direct. 6 teams advance, 4 groups → 1 per group direct + 2 best 3rd-place by PPG.

### 2.5 Knockout bracket with placeholders

**Schema changes** (`supabase/migrations/0009_bracket_placeholders.sql`):

```sql
-- Allow nullable team IDs in matches (placeholders use placeholder strings instead)
alter table matches alter column home_team_id drop not null;
alter table matches alter column away_team_id drop not null;

-- Placeholder strings for unresolved slots
alter table matches add column home_placeholder text;
alter table matches add column away_placeholder text;

-- Knockout-specific: position in the bracket
-- Examples: 'R16_1'..'R16_8', 'QF_1'..'QF_4', 'SF_1'..'SF_2', 'F', 'TP' (third place)
-- bracket_position already exists from iter1; widen check if needed
alter table matches drop constraint if exists matches_check;

-- A match needs either both team_ids OR both placeholders set
alter table matches add constraint matches_slots_specified check (
  (home_team_id is not null or home_placeholder is not null)
  and (away_team_id is not null or away_placeholder is not null)
);

-- Add a "group stage locked" flag at tournament level
create table if not exists tournament_state (
  id boolean primary key default true check (id),
  group_stage_locked boolean not null default false,
  group_stage_locked_at timestamptz
);
insert into tournament_state (id) values (true) on conflict do nothing;
```

**Placeholder string format:**
- Group position: `{GROUP_LETTER}{POSITION}` — e.g., `A1`, `B2`, `C3`
- Best 3rd place (across groups): `BEST3_1`, `BEST3_2` (1st-ranked best 3rd, 2nd-ranked best 3rd)
- Winner of a knockout match: `W_{BRACKET_POSITION}` — e.g., `W_QF_1`, `W_SF_2`
- Loser (for 3rd place playoff): `L_{BRACKET_POSITION}` — e.g., `L_SF_1`, `L_SF_2`

**Bracket generation function** (`lib/bracket.ts`):

```typescript
export type BracketSlot = string; // placeholder string like 'A1', 'W_QF_1'

export interface BracketMatch {
  bracket_position: string; // 'R16_1', 'QF_1', 'SF_1', 'F', 'TP'
  round_name: string; // 'Osmina finala', 'Cetvrtfinale', 'Polufinale', 'Finale', 'Treci mesto'
  home: BracketSlot;
  away: BracketSlot;
}

export function generateBracket(
  groupLetters: string[], // ['A','B','C','D']
  advancingPerGroup: number, // e.g., 2
  bestThirds: number, // e.g., 0 or 2
  includeThirdPlace: boolean = true
): BracketMatch[] {
  const totalAdvancing = groupLetters.length * advancingPerGroup + bestThirds;
  if (![2, 4, 8, 16].includes(totalAdvancing)) {
    throw new Error('Total advancing must be 2, 4, 8, or 16');
  }
  
  // Build initial slots
  const slots: BracketSlot[] = [];
  // Standard seeding: A1, B1, C1, ...; then A2, B2, ...; then best thirds
  for (let pos = 1; pos <= advancingPerGroup; pos++) {
    for (const g of groupLetters) {
      slots.push(`${g}${pos}`);
    }
  }
  for (let i = 1; i <= bestThirds; i++) {
    slots.push(`BEST3_${i}`);
  }
  
  // Standard knockout pairing to avoid same-group rematches in early rounds:
  // Seed the bracket so that 1-seeds meet 2-seeds from other groups.
  // For 4 advancing (2 groups × 2): A1-B2, B1-A2
  // For 8 advancing (4 groups × 2): A1-B2, C1-D2, B1-A2, D1-C2
  // For 8 advancing (2 groups × 4): A1-B2, A3-B4, A2-B1, A4-B3
  // Implement a generic pairing that walks the slots array with a stride pattern.
  
  // ... (full implementation in lib/bracket.ts)
}
```

The bracket structure follows a standard tournament tree:
- 16 teams → R16 (8 matches) → QF (4) → SF (2) → F (1) [+ TP (1) if includeThirdPlace]
- 8 teams → QF (4) → SF (2) → F (1) [+ TP (1)]
- 4 teams → SF (2) → F (1) [+ TP (1)]
- 2 teams → F (1)

**Generation at any time:**
- Admin clicks "Generiši nokaut kostur" at `/admin/bracket` even before group stage starts
- All bracket matches inserted with `home_placeholder`/`away_placeholder` filled and team IDs null
- Matches assigned to NEW rounds with `stage='knockout'` and appropriate names

**Re-generating** wipes existing knockout matches and rounds (with confirm modal). Group stage matches are NOT touched.

### 2.6 Placeholder resolution

**Resolution trigger 1: group stage lock**

Admin clicks **"Zaključaj grupnu fazu"** at `/admin/bracket` (or `/admin/schedule`). This:

1. Verifies all group-stage matches have `phase='finished'`. If not, show error listing unfinished matches.
2. Sets `tournament_state.group_stage_locked = true`
3. Computes standings for each group (uses the existing `standings` view + tiebreakers)
4. Resolves all `{GROUP}{POS}` placeholders to actual `team_id`s
5. If `BEST3_X` placeholders exist, computes them via PPG ranking across all groups' 3rd-placed teams (or whatever rank `BEST3` refers to — for now: best 3rd-placed teams)

**Group standings tiebreakers** (in order):
1. Points
2. Goal difference
3. Goals scored
4. Head-to-head record (between tied teams)
5. Disciplinary points (yellow=1, red=3)
6. Random (deterministic via seed — use match start order)

**PPG ranking for cross-group comparison:**
- `ppg = points / games_played`
- Sort by ppg desc, then goal_diff/games desc, then goals_for/games desc

**Resolution trigger 2: knockout match finishes**

When a knockout match transitions to `phase='finished'`:
- Determine winner (compare scores; if equal, admin must enter a winner via a "Penali / Produzeci" UI — see below)
- For every match with `home_placeholder = 'W_<this match>'` or `away_placeholder = 'W_<this match>'`, set the corresponding `*_team_id` and clear the placeholder
- Same for `L_<this match>` placeholders (3rd place playoff)

**Tie-breaking in knockout:**
- After 2nd half ends with equal score, admin sees buttons: **"Penali"**, **"Produzeci"**, **"Završi sa pobednikom"**
- Penali / Produzeci: admin manually selects winner via dropdown
- Store this as `matches.knockout_winner_id` (nullable)
- For knockout matches, the "winner" is `knockout_winner_id` if set, else derived from score

**Schema addition:**
```sql
alter table matches add column knockout_winner_id uuid references teams(id);
```

### 2.7 Manual override

At `/admin/bracket`, every bracket slot is interactive:
- Click an unresolved slot → modal with dropdown of all teams → manually assign
- Click a resolved slot → modal with: "Promeni tim" / "Vrati na placeholder"
- Drag-and-drop two slots to swap them (using existing `@dnd-kit` setup)
- Show clear visual distinction: placeholder (gray italic) vs resolved (team crest + name)

Admin can lock the group stage WITHOUT having all matches finished — show a "Force lock" option with a warning. This is for situations where some matches won't be played.

Manual overrides persist through group-stage relock; admin's manual assignment wins over computed resolution.

### 2.8 Fair handling of uneven groups

Already covered by PPG normalization above. Specifically:
- Within a group: standings are by points (all teams played same number of games)
- Across groups (for best-thirds, or for any cross-group ranking): use PPG
- Admin can always override

**Optional: playout round** (not auto-generated — admin creates manually if desired)
- Document in the UI tip: "Ako želite playout meč između najlošije plasiranih timova iz različitih grupa, kreirajte ga ručno u sekciji Mečevi sa kolom 'Playout'."

### 2.9 Bracket UI

`/admin/bracket` redesigned:

**Top section: Configuration**
- Number input: "Timova koji prolazi ukupno" (2/4/8/16 dropdown)
- Number input: "Timova po grupi direktno"
- Calculated readout: "Najbolji X trecih plasiranih"
- Checkbox: "Uključi meč za 3. mesto"
- Button: **"Generiši nokaut"** (with re-gen warning if bracket already exists)

**Middle section: Bracket tree visualization**
- Horizontal tree (left to right): early rounds on left, final on right
- Each match shown as a card with two slots stacked
- Slot: placeholder or team (crest + name)
- Click slot to edit
- Lines connecting matches showing winner path
- Mobile: vertical stack with collapsible rounds

**Bottom section: Group stage lock**
- Status: "Grupna faza: aktivna / zaključana"
- Lock button (validates all finished) + Force-lock option
- Unlock button to revert (clears all auto-resolved placeholders, keeps manual overrides)

**Public bracket page** (`/bracket`):
- Same visual tree, read-only
- Updates via realtime when knockout matches change
- Shows placeholders if not yet resolved

### 2.10 Standings tiebreakers — full implementation

Replace the simple `standings` view with a more complete one that includes tiebreaker data:

```sql
-- Migration 0010
create or replace view standings as
with finished as (
  select * from matches where phase = 'finished' and stage_from_round(round_id) = 'group'
  -- stage_from_round helper: select stage from rounds where id = round_id
),
team_perspective as (
  select 
    m.home_team_id as team_id, m.group_id,
    m.home_score as gf, m.away_score as ga, m.id as match_id
  from finished m
  union all
  select 
    m.away_team_id, m.group_id, m.away_score, m.home_score, m.id
  from finished m
),
discipline as (
  select 
    e.team_id,
    sum(case when e.event_type = 'yellow_card' then 1 else 0 end) as yellows,
    sum(case when e.event_type = 'red_card' then 1 else 0 end) as reds
  from match_events e
  group by e.team_id
)
select 
  tp.team_id, tp.group_id,
  count(*)::int as played,
  sum(case when tp.gf > tp.ga then 1 else 0 end)::int as wins,
  sum(case when tp.gf = tp.ga then 1 else 0 end)::int as draws,
  sum(case when tp.gf < tp.ga then 1 else 0 end)::int as losses,
  sum(tp.gf)::int as goals_for,
  sum(tp.ga)::int as goals_against,
  (sum(tp.gf) - sum(tp.ga))::int as goal_diff,
  sum(case when tp.gf > tp.ga then 3 when tp.gf = tp.ga then 1 else 0 end)::int as points,
  -- PPG for cross-group comparison
  case when count(*) > 0 
    then sum(case when tp.gf > tp.ga then 3 when tp.gf = tp.ga then 1 else 0 end)::numeric / count(*)
    else 0 
  end as ppg,
  coalesce(d.yellows, 0)::int as yellow_cards,
  coalesce(d.reds, 0)::int as red_cards,
  (coalesce(d.yellows, 0) + coalesce(d.reds, 0) * 3)::int as discipline_points
from team_perspective tp
left join discipline d on d.team_id = tp.team_id
group by tp.team_id, tp.group_id, d.yellows, d.reds;

grant select on standings to anon, authenticated;
```

**Sorting** (in app code or as a separate function):
1. points desc
2. goal_diff desc
3. goals_for desc
4. head-to-head (computed separately for tied teams)
5. discipline_points asc
6. random/insertion order

Implement head-to-head as a separate function `compute_h2h(team_a_id, team_b_id)` returning the points each team got from their direct matches.

---

## 3. Execution order

### Phase 1 — Setup & cleanup
1. Verify branch is clean, create `iter3-knockout-system`
2. Migration `0008_drop_player_position.sql`
3. Regenerate types
4. Remove all `position` references from app code
5. Commit: "Drop player position"

### Phase 2 — Fix draw bug
6. Write `__tests__/draw.test.ts` with all 8 scenarios from section 2.3
7. Run tests — most should fail initially with the broken code
8. Fix `lib/draw.ts` with the corrected implementations
9. Fix `components/DrawAnimation.tsx`:
   - Compute result first, animate from stored state
   - Verify animation handles 2-team groups (just one card per group)
   - Verify "Preskoči" works at any stage
10. Run tests — all pass
11. Manual test: 4 teams + 2 groups end-to-end including commit
12. Commit: "Fix draw bug for small groups; add unit tests"

### Phase 3 — Photo upload anywhere
13. Audit `/admin/players` for any tournament-state-based gating
14. Remove blocks; verify edit modal works for existing players
15. Test: add a player + photo AFTER draw is complete
16. Commit: "Player edits + photos available at any tournament stage"

### Phase 4 — Bracket schema & placeholders
17. Migration `0009_bracket_placeholders.sql` (nullable team_ids, placeholder columns, tournament_state, knockout_winner_id)
18. Migration `0010_standings_with_tiebreakers.sql` (new view)
19. Add `lib/bracket.ts` with `generateBracket` and `pairBracketSlots`
20. Unit tests for bracket generation: 2/4/8/16 team scenarios with various group configurations
21. Add Server Action `generateKnockoutBracket(advancingPerGroup, bestThirds, includeThirdPlace)`
22. Commit: "Bracket data model with placeholders"

### Phase 5 — Bracket UI
23. Redesign `/admin/bracket` with config section + tree visualization + lock controls
24. Implement slot click → edit modal with team dropdown
25. Implement drag-to-swap between slots (`@dnd-kit`)
26. Public `/bracket` page with read-only tree + realtime subscription
27. Commit: "Bracket UI with manual overrides"

### Phase 6 — Group stage lock + resolution
28. Server Action `lockGroupStage()` that:
    - Validates all group matches finished (or force flag)
    - Computes standings with tiebreakers
    - Resolves all group placeholders in knockout matches
    - Sets `tournament_state.group_stage_locked = true`
29. Server Action `unlockGroupStage()` that reverts (keeps manual overrides)
30. Tiebreaker logic in `lib/standings.ts`: `sortGroupStandings(teams)` and `rankBestThirds(groups)`
31. Head-to-head function in DB or app
32. Commit: "Group stage lock and placeholder resolution"

### Phase 7 — Knockout match finishing
33. Add UI for tie-breaking after 2nd half ends with equal score:
    - "Penali" / "Produzeci" / "Završi sa pobednikom" buttons
    - Manual winner selection if tied
    - Set `knockout_winner_id`
34. Trigger or Server Action on knockout match finish that resolves `W_*` and `L_*` placeholders in dependent matches
35. Commit: "Knockout tie-breaking and winner propagation"

### Phase 8 — Polish & deploy
36. Update README admin workflow:
    1. Add teams
    2. Add players (no position field)
    3. Run group draw at `/admin/draw`
    4. (Optional, any time) Generate knockout skeleton at `/admin/bracket`
    5. Play group matches via live UI
    6. Lock group stage when done → placeholders resolve
    7. Play knockout matches; winners auto-advance
    8. Manual overrides available throughout
37. `npm run build` — must pass
38. `npm run reset` — clean DB
39. Manual smoke test: 4 teams + 2 groups + 4 advancing → full tournament end-to-end
40. `npx vercel --prod --token "$VERCEL_TOKEN" --yes`
41. Print live URL

---

## 4. Quality rules

- All bracket math in pure functions in `lib/`, fully tested
- Animation state separated from data state (animation is presentational only)
- All placeholder resolution wrapped in DB transaction so partial resolutions don't leave bracket in mixed state
- `tournament_state` is a singleton — enforce with the `id boolean primary key default true` pattern
- Manual overrides stored separately from auto-resolutions so re-locking doesn't lose them (add `home_team_id_override`, `away_team_id_override` columns if simpler than tracking provenance)
- All UI on mobile-first
- No `any` in TypeScript

---

## 5. Final deliverable checklist

- [ ] Player `position` field fully removed
- [ ] Photo upload works after draw and during any tournament phase
- [ ] 4-team-2-group draw runs end-to-end without errors
- [ ] All 8 draw scenarios in unit tests pass
- [ ] `/admin/bracket` lets admin generate skeleton at any time
- [ ] Skeleton uses placeholders (`A1`, `W_QF_1`, etc.)
- [ ] Group stage lock resolves all group placeholders
- [ ] Knockout match completion resolves dependent placeholders
- [ ] Tie-breaking UI works for equal-score knockout matches
- [ ] PPG ranking handles uneven groups correctly
- [ ] Manual override available on every bracket slot
- [ ] Public `/bracket` page shows live state, updating via realtime
- [ ] `npm run build` passes
- [ ] Deployed and live

Begin now.
