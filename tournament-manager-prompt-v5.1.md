# Tournament Manager — Iteration 5.1 (Lock Down Match Mutations)

**Apply this ON TOP of iter5** in the same Claude Code session. Paste iter5 first, let Claude work through it, then paste this. Or paste both together at the start of the session — Claude will see both.

Same branch as iter5: `iter5-corners-and-penalties`

---

## 1. Why

Matches are now exclusively created by:
- **Group draw** at `/admin/draw` — generates full round-robin for each group
- **Bracket generator** at `/admin/bracket` — generates knockout skeleton with placeholders

Allowing manual match creation breaks the round-robin (admin could accidentally create duplicate or missing fixtures), and the system has no UI need for one-off matches. The matchup (home/away team pairing) is determined by the draw and cannot be edited manually — only the **date**, **kickoff time**, and **kolo assignment** (which date column the match sits in) can be changed by the admin.

---

## 2. Changes

### 2.1 Remove match creation UI

Audit and delete:
- Any "Dodaj mec" / "Novi mec" / "Add match" / "Create match" button from `/admin/matches`, `/admin/schedule`, anywhere
- Any standalone `/admin/matches/new` route or modal
- Any "Create" form in match-related admin pages

### 2.2 Restrict / remove match-creation Server Action

Find the Server Action that creates matches (likely `createMatch` or similar in `app/admin/matches/actions.ts`).

Two options, pick one:

**Option A (preferred): delete the Server Action entirely**
- If only the draw and bracket generator use it, refactor them to use the supabase admin client directly inline
- Delete the public Server Action so it can't be called

**Option B: rename + restrict**
- Rename to `_internalCreateMatch` (underscore prefix as convention for internal-only)
- Add a runtime check that throws if called from anywhere except `lib/draw.ts` or `lib/bracket.ts`
- (This is brittle — Option A is cleaner)

### 2.3 Disable delete on matches in admin

Admin should NOT be able to delete an individual match either — that would also break round-robin completeness.

- Remove any "Obriši mec" / "Delete" button on match cards / rows
- Remove the corresponding Server Action `deleteMatch` (or restrict like 2.2)

**The only way to remove all matches is via reset** (`npm run reset` soft reset clears matches + groups + events; `/admin/danger-zone` UI does the same). This is documented and intentional.

### 2.4 What admin CAN still do per match

After this change, the per-match admin actions allowed are:
- Assign / change `match_date` (via drag-drop on `/admin/schedule`)
- Set / change `kickoff_time` (per match or batch per date column)
- Mark phase: scheduled → first_half → halftime → second_half → finished
- Log events during live phases
- Delete individual events from the event feed
- For knockout matches only: override `home_team_id` / `away_team_id` (manual placeholder resolution from iter3)

### 2.5 UX guidance

On `/admin/matches` (list page), at the top, add a small info banner:

```
ℹ️  Mečevi se generišu automatski preko Žreba i Nokaut žreba.
   Ovde možete dodeliti datume i menjati raspored.
   [Idi na Žreb]  [Idi na Raspored]
```

If the matches list is empty (no draw yet), make the empty state actionable:

```
   Još nema mečeva.
   Pokrenite žreb da generišete grupne mečeve.
   [Pokreni žreb →]
```

### 2.6 RLS lockdown (belt-and-suspenders)

Even though admin actions go through service role (bypassing RLS), add an extra safety net at the DB level. Append to migration `0014`:

```sql
-- Prevent any future accidental writes from authenticated users on matches
-- (admin already goes through service role, so this only locks down regular users)
drop policy if exists "Admin insert matches" on matches;
drop policy if exists "Admin update matches" on matches;
drop policy if exists "Admin delete matches" on matches;
-- No INSERT/UPDATE/DELETE policies for authenticated role — service role is the only writer
```

(Existing public SELECT policy stays unchanged.)

### 2.7 README

Add a brief note under the admin workflow:

```markdown
## Manuelne izmene mečeva

Mečevi se ne kreiraju ručno — postoje samo oni koji su generisani:

- **Grupna faza:** automatski preko `/admin/draw` (round-robin svako sa svakim u grupi)
- **Nokaut:** automatski preko `/admin/bracket` (sa placeholder pozicijama)

Admin može da:
- ✅ Dodeli datum meču (`/admin/schedule`)
- ✅ Pomeri meč u drugo kolo (drag-drop između datuma)
- ✅ Postavi vreme početka
- ✅ Pokrene/zaustavi meč i unese događaje
- ❌ NE može da kreira nov meč
- ❌ NE može da obriše pojedinačan meč

Za brisanje svih mečeva: `npm run reset` ili `/admin/danger-zone`.
```

---

## 3. Execution order (extend iter5's phases)

Insert this between Phase 1 (schema) and Phase 2 (UI cleanup) of iter5:

### Phase 1.5 — Lock down match mutations
- Audit codebase for match-create UI; delete buttons, routes, forms
- Audit Server Actions for create/delete match; delete or rename + restrict
- Add empty state and info banner to `/admin/matches`
- Append RLS lockdown to migration `0014`
- Update README
- Commit: "Lock down: no manual match creation or deletion"

---

## 4. Checklist (additions to iter5)

- [ ] No "Dodaj mec" / "Create match" button exists anywhere
- [ ] No "Obriši mec" / "Delete match" button exists
- [ ] No `/admin/matches/new` route
- [ ] `createMatch` Server Action deleted or restricted to internal-only callers
- [ ] `deleteMatch` Server Action deleted or restricted
- [ ] `/admin/matches` shows info banner explaining matches come from draw
- [ ] Empty state on matches list links to `/admin/draw`
- [ ] No authenticated-role write policies on `matches` table (only service role writes)
- [ ] README clarifies what admin can / cannot do per match

That's it. Small change, big guardrail.
