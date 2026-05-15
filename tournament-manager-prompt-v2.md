# Tournament Manager — Iteration 2 (Format Overhaul + Auto-Draw + Reset Tooling)

You are modifying the existing Tournament Manager project in the current working directory. This is an **iterative update**, not a rebuild. Preserve existing infrastructure (Supabase project, Vercel deployment, auth setup, env vars). Add new migrations, modify existing code, redeploy.

---

## 0. Preconditions

- Run from inside the existing project root (where `package.json`, `supabase/`, `app/` already exist)
- Read `.env.local` for credentials — all previously configured vars remain valid
- Verify `git status` is clean before starting; commit any in-flight work first
- Create a working branch: `git checkout -b iter2-format-overhaul`

---

## 1. Summary of changes

1. **Remove 3v3 / no-goalkeeper assumptions** — make tournament format flexible
2. **Auto-draw system** — admin inputs only teams + group count, system generates groups and fixtures
3. **Draw animation** — visual ceremony when admin runs the draw
4. **Drag-and-drop fixture reordering** — admin can move matches between kola
5. **Team colors + auto-generated SVG crest** — two colors per team, crest shown next to team name everywhere
6. **Player photos** — uploadable, displayed next to player info
7. **Match clock** — 2×20 minutes, live red minute counter at top of match page
8. **Event-driven scoring** — score cannot be set directly; every score change must be a logged event with minute + player + type
9. **Auto-update standings** — after match finishes, standings recompute immediately
10. **Round (kolo) semantics clarified** — a kolo is a container for the matches played during that matchday; creating a kolo = entering its matches
11. **Database reset tool** — both CLI (`npm run reset`) and admin UI button to wipe all tournament data back to a clean post-deploy state, preserving the admin user

---

## 2. Detailed specifications

### 2.1 Remove 3v3 specifics

Search the codebase for all references to:
- "3v3", "3x3", "no goalkeeper", "3 starting players", "3 players + substitutes"

Replace with format-neutral wording. The tournament now supports any team roster size, any match player count. Specifically:

- Remove any hardcoded constraint that a team must have exactly 3 players in its roster
- Roster size is flexible per team — admin adds as many players as needed
- Clean sheet bonus (fantasy) goes to ALL players on a team that conceded 0, regardless of roster size
- Update README and all UI copy accordingly

The **fantasy team** still has exactly 3 player slots — that's a fantasy gameplay decision and stays unchanged.

### 2.2 Round (kolo) semantics — IMPORTANT clarification

Creating a kolo means entering all matches that will be played during that matchday. Specifically:

- A **kolo** is a tournament-wide matchday (e.g., "Kolo 1" might contain 4 matches across all groups, all played on the same day or weekend)
- A **match** belongs to exactly one kolo
- In the admin flow, you don't "create a kolo" as an empty container then later add matches — kola are generated automatically when fixtures are generated (see auto-draw below)
- Admin CAN manually add or move matches between kola, but the kola themselves come from the draw

Update `/admin/rounds` to be a read-only overview (or rename to `/admin/schedule`) showing all kola with their matches. Match assignment to kolo is handled via `/admin/matches` (drag-and-drop) or auto-draw.

### 2.3 Team colors + auto-generated crest

**Schema migration** (`supabase/migrations/0003_team_colors.sql`):
```sql
alter table teams add column primary_color text not null default '#1f2937';
alter table teams add column secondary_color text not null default '#f3f4f6';
```

**Crest component** (`components/TeamCrest.tsx`):
- Pure client SVG, no storage needed
- Inputs: team name, primary_color, secondary_color, size (default 32px)
- Generates a shield/badge SVG:
  - Diagonal split (top-left to bottom-right) using the two colors
  - Team initials (first 2 chars of `short_name` or first letters of each word in `name`) centered in white or auto-contrasted color
  - Subtle border, rounded corners
- Memoize by team_id
- Used everywhere a team is displayed: standings rows, match cards, fixture lists, bracket, fantasy player cards (showing player's team)

**Admin UI** (`/admin/teams`):
- Color pickers for primary/secondary (use native `<input type="color">` for simplicity)
- Live preview of the generated crest as colors change
- Validation: colors must differ (warn but allow), must be valid hex

### 2.4 Player photos

**Storage setup** (`supabase/migrations/0004_player_photos.sql`):
```sql
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

-- Allow authenticated upload (admin check at app layer)
create policy "Public read" on storage.objects for select
using (bucket_id = 'player-photos');

create policy "Authenticated upload" on storage.objects for insert
to authenticated with check (bucket_id = 'player-photos');

create policy "Authenticated update" on storage.objects for update
to authenticated using (bucket_id = 'player-photos');

create policy "Authenticated delete" on storage.objects for delete
to authenticated using (bucket_id = 'player-photos');
```

**Schema**:
```sql
alter table players add column photo_url text;
```

**Admin UI** (`/admin/players`):
- File input accepting images
- Client-side resize to max 400×400 (use canvas), compress to JPEG quality 0.85, max ~100KB
- Upload via Server Action that uses service role client → storage
- File path: `{player_id}/{timestamp}.jpg`
- On player delete, also remove their photo from storage

**Display**:
- `PlayerAvatar` component — rounded-full, falls back to initials on colored circle (using their team's primary color) if no photo
- Used in: `/players`, `/players/[id]`, match event feed (small), fantasy team selector, top scorers list

### 2.5 Auto-draw system

This is the biggest new feature. Admin workflow becomes:

1. `/admin/teams` — add all teams with colors
2. `/admin/players` — add all players (with optional photos) to teams
3. `/admin/draw` — NEW page:
   - Input: number of groups (2–8)
   - Display: list of all teams, count, validation (must be divisible-ish)
   - Button: **"Pokreni žreb"**
   - On click → animated draw → fixtures generated → review → confirm

**Draw algorithm** (`lib/draw.ts`):

```typescript
function distributeTeams(teams: Team[], groupCount: number): Team[][] {
  // Fisher-Yates shuffle
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  // Snake distribution: 1,2,3,...,N,N,...,3,2,1 to balance group strengths
  const groups: Team[][] = Array.from({length: groupCount}, () => []);
  shuffled.forEach((team, i) => {
    const row = Math.floor(i / groupCount);
    const col = i % groupCount;
    const groupIdx = row % 2 === 0 ? col : groupCount - 1 - col;
    groups[groupIdx].push(team);
  });
  return groups;
}

function generateRoundRobin(teams: Team[]): { round: number; home: Team; away: Team }[] {
  // Circle method for round-robin
  // For N teams, N-1 rounds (add bye if odd)
  const ts = [...teams];
  if (ts.length % 2 === 1) ts.push(null as any); // bye marker
  const n = ts.length;
  const rounds = n - 1;
  const fixtures: { round: number; home: Team; away: Team }[] = [];
  
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const home = ts[i];
      const away = ts[n - 1 - i];
      if (home && away) {
        fixtures.push({ round: r + 1, home, away });
      }
    }
    // Rotate (keep ts[0] fixed)
    ts.splice(1, 0, ts.pop()!);
  }
  return fixtures;
}
```

**Tournament-wide kola assignment**:
- Each group has its own round-robin (e.g., 4 teams → 3 rounds, 6 teams → 5 rounds)
- Tournament total kola count = max rounds across any group
- Group round N → Tournament Kolo N (so all groups play their round 1 matches in Kolo 1, etc.)
- Smaller groups simply have no matches in later kola

**Confirmation step**:
After draw runs, show preview:
- Groups with assigned teams (with crests)
- Per-kolo match list
- "Potvrdi" (commit to DB) / "Ponovi žreb" (reroll) / "Odustani"

On confirm, in a single transaction:
- Insert `groups` rows
- Insert `group_teams` rows
- Insert `rounds` rows (Kolo 1, Kolo 2, ...)
- Insert `matches` rows with status='scheduled'

Re-running the draw on an already-drawn tournament must require a confirm modal AND wipe existing groups/matches/rounds/group_teams (but never wipe teams or players).

### 2.6 Draw animation

`components/DrawAnimation.tsx`:

- Full-viewport overlay (or large modal)
- Header: "Žreb u toku..."
- Stage 1 (~6 seconds): all team cards (with crests) shuffled in a pile, animated bouncing/shuffling
- Stage 2 (~8 seconds): one team card at a time "flies" from the pile into its group slot
  - Group containers visible below
  - Each team picked: 0.6–0.8s with easing
  - Sound effect: optional, default off
- Stage 3: brief celebration flash, then show the static result with "Potvrdi" CTA
- "Preskoči" button always visible top-right

Use **Framer Motion** for animations (`npm i framer-motion`). The animation reads pre-computed group assignments — it's purely visual, the draw result is already determined when animation starts.

### 2.7 Drag-and-drop fixture reordering

After fixtures are generated, admin must be able to move matches between kola.

Use **@dnd-kit/core** + **@dnd-kit/sortable** (`npm i @dnd-kit/core @dnd-kit/sortable`).

`/admin/schedule` (renamed from `/admin/rounds`):
- Columns = kola, vertical list of matches per column
- Drag a match card from Kolo 1 to Kolo 3 → updates `matches.round_id` via Server Action
- Show home/away teams with crests on each card
- Locked kola (status='active' or 'finished') are not draggable; show lock icon

### 2.8 Match clock (2×20 minutes)

**Schema migration** (`supabase/migrations/0005_match_phases.sql`):
```sql
alter table matches add column phase text not null default 'scheduled'
  check (phase in ('scheduled','first_half','halftime','second_half','finished'));
alter table matches add column second_half_started_at timestamptz;
-- Drop the old simple status column eventually, or keep both:
-- For now, derive status from phase: scheduled = scheduled, first_half/halftime/second_half = live, finished = finished
```

Update existing `status` column to be a generated column or update via trigger when `phase` changes.

**Admin actions** at `/admin/matches/[id]/live`:
- Big button: **"Pokreni mec"** → phase='first_half', started_at=now()
- During first half: log events (only mode available), button **"Kraj prvog poluvremena"** → phase='halftime'
- During halftime: only "Pokreni drugo poluvreme" available, sets phase='second_half', second_half_started_at=now()
- During second half: log events, button **"Zavrsi mec"** → phase='finished'

**Public match page** (`/matches/[id]`):
- Top of page, centered:
  - Phase indicator + minute display
  - Phase = first_half: red pulsing text, calculated minute (1' to 20')
  - Phase = halftime: yellow "POLUVREME"
  - Phase = second_half: red pulsing text, minute 21' to 40' (continuous count)
  - Phase = finished: gray "ZAVRSENO" or "FT"

**Minute calculation** (`lib/matchClock.ts`):
```typescript
function getCurrentMinute(match: Match): number | null {
  if (match.phase === 'first_half') {
    const elapsed = (Date.now() - new Date(match.started_at).getTime()) / 60000;
    return Math.min(Math.floor(elapsed) + 1, 20);
  }
  if (match.phase === 'second_half') {
    const elapsed = (Date.now() - new Date(match.second_half_started_at).getTime()) / 60000;
    return Math.min(20 + Math.floor(elapsed) + 1, 40);
  }
  return null;
}
```

Client polls / updates every 1 second using `setInterval` inside a `useEffect` while phase is `first_half` or `second_half`.

**Event minute auto-fill**:
- When admin opens the event entry form, default the minute input to the current calculated minute
- Admin can override (e.g., for a goal at 14' logged at 14:30)

### 2.9 Event-driven scoring (no raw score edits)

**Remove all admin UI that directly edits `matches.home_score` / `matches.away_score`.** The score becomes a derived value.

**Approach: trigger-maintained cache.**
- Keep `home_score` and `away_score` columns
- Add trigger on `match_events` (INSERT/UPDATE/DELETE):
  ```sql
  create or replace function refresh_match_score(p_match_id uuid) returns void as $$
  declare v_home uuid; v_away uuid;
  begin
    select home_team_id, away_team_id into v_home, v_away from matches where id = p_match_id;
    
    update matches set
      home_score = (
        select count(*) from match_events
        where match_id = p_match_id
          and ((event_type = 'goal' and team_id = v_home)
            or (event_type = 'own_goal' and team_id = v_away))
      ),
      away_score = (
        select count(*) from match_events
        where match_id = p_match_id
          and ((event_type = 'goal' and team_id = v_away)
            or (event_type = 'own_goal' and team_id = v_home))
      )
    where id = p_match_id;
  end;
  $$ language plpgsql security definer;
  ```
- Trigger calls this after every match_events change

**Event form requirements**:
- Goal: requires player_id (from team's roster), team_id (auto-derived from player), minute (required, default = current match minute)
- Own goal: requires player_id, team_id (the team that scores, i.e. NOT the player's team), minute
- Yellow/red card: requires player_id, team_id, minute
- All forms reject submission without minute

### 2.10 Auto-update standings

Replace any client-side standings calculation with a **Postgres view** that's always live:

**Migration** (`supabase/migrations/0006_standings_view.sql`):
```sql
create or replace view standings as
with finished_matches as (
  select * from matches where phase = 'finished'
),
team_results as (
  select 
    home_team_id as team_id,
    group_id,
    home_score as gf,
    away_score as ga
  from finished_matches
  union all
  select 
    away_team_id, group_id, away_score, home_score
  from finished_matches
)
select 
  team_id,
  group_id,
  count(*)::int as played,
  sum(case when gf > ga then 1 else 0 end)::int as wins,
  sum(case when gf = ga then 1 else 0 end)::int as draws,
  sum(case when gf < ga then 1 else 0 end)::int as losses,
  sum(gf)::int as goals_for,
  sum(ga)::int as goals_against,
  (sum(gf) - sum(ga))::int as goal_diff,
  (sum(case when gf > ga then 3 when gf = ga then 1 else 0 end))::int as points
from team_results
group by team_id, group_id;

grant select on standings to anon, authenticated;
```

**Realtime invalidation**: since standings is a view, clients re-fetch it whenever `matches` or `match_events` changes. The realtime subscription on `matches` already fires when phase changes to 'finished'.

`/standings` page subscribes to matches changes and re-queries on update.

### 2.11 Database reset tool (HIGH PRIORITY — implement early)

You'll be testing repeatedly. Reset must be one command away.

**Migration** (`supabase/migrations/0002_reset_function.sql` — note: insert this EARLY in migration order, renumber if needed):

```sql
create or replace function reset_tournament_data() returns void as $$
begin
  -- Order matters due to foreign keys
  truncate table 
    fantasy_round_points,
    fantasy_player_points,
    fantasy_team_snapshots,
    player_transfers,
    player_prices,
    fantasy_league_members,
    fantasy_leagues,
    fantasy_teams,
    match_events,
    matches,
    rounds,
    group_teams,
    groups,
    players,
    teams
  cascade;
end;
$$ language plpgsql security definer;

revoke all on function reset_tournament_data() from public;
-- Only callable via service role
```

**CLI script** (`scripts/reset-db.ts`):
```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import readline from 'readline';

config({ path: '.env.local' });

const force = process.argv.includes('--force');
const yes = process.argv.includes('--yes');

async function main() {
  if (!force && !yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>(r => rl.question('Type RESET to confirm wipe: ', r));
    rl.close();
    if (answer !== 'RESET') { console.log('Aborted.'); process.exit(0); }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1) Wipe data tables via RPC
  const { error: dbErr } = await supabase.rpc('reset_tournament_data');
  if (dbErr) { console.error('DB reset failed:', dbErr); process.exit(1); }
  console.log('✓ Tournament data wiped');

  // 2) Wipe non-admin auth users
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const adminEmail = process.env.ADMIN_EMAIL!;
  for (const u of users?.users ?? []) {
    if (u.email !== adminEmail) {
      await supabase.auth.admin.deleteUser(u.id);
    }
  }
  console.log('✓ Non-admin users wiped');

  // 3) Wipe player-photos bucket
  const { data: files } = await supabase.storage.from('player-photos').list('', { limit: 10000 });
  if (files?.length) {
    const paths: string[] = [];
    // Recursive list since photos are in {player_id}/{file}.jpg
    for (const folder of files) {
      const { data: inner } = await supabase.storage.from('player-photos').list(folder.name, { limit: 1000 });
      inner?.forEach(f => paths.push(`${folder.name}/${f.name}`));
    }
    if (paths.length) await supabase.storage.from('player-photos').remove(paths);
  }
  console.log('✓ Player photos wiped');

  // 4) Ensure admin profile is intact (recreate if needed)
  const { data: { users: postUsers } } = await supabase.auth.admin.listUsers();
  const admin = postUsers?.find(u => u.email === adminEmail);
  if (admin) {
    await supabase.from('profiles').upsert({ id: admin.id, email: adminEmail, role: 'admin' });
  }
  console.log('✓ Admin profile verified');

  console.log('\n🎉 Database reset complete. Ready for fresh tournament.');
}

main().catch(e => { console.error(e); process.exit(1); });
```

**Add to `package.json`**:
```json
"scripts": {
  "reset": "tsx scripts/reset-db.ts",
  "reset:force": "tsx scripts/reset-db.ts --force"
}
```

**Admin UI** (`/admin/danger-zone/page.tsx`):
- Big red card with warning iconography
- "Resetuj sve podatke turnira" button → opens modal
- Modal asks to type `RESETUJ` (Serbian) to enable the confirm button
- Confirm calls a Server Action that:
  1. Verifies caller is admin (profiles.role check)
  2. Calls `supabase.rpc('reset_tournament_data')` via admin client
  3. Wipes non-admin auth users
  4. Wipes player-photos bucket
  5. Returns `{ ok: true }`
- On success: toast "Resetovano", redirect to `/admin`

Both interfaces (CLI and UI) call the same underlying logic. Extract shared reset routine into `lib/reset.ts` if it cleans up the code.

---

## 3. Execution order

Run phases in this order. Commit after each phase with the indicated message.

### Phase 1 — Reset tool first (so we can iterate)
1. Write migration `0002_reset_function.sql` (renumber existing migrations if 0002 is taken — make this the FIRST new migration)
2. Write `scripts/reset-db.ts`
3. Add `npm run reset` script
4. `npx supabase db push`
5. Test: `npm run reset` (with empty DB, should succeed harmlessly)
6. Commit: "Add database reset tool"

### Phase 2 — Schema migrations for new features
7. `0003_team_colors.sql` — primary_color, secondary_color on teams
8. `0004_player_photos.sql` — players.photo_url, storage bucket, policies
9. `0005_match_phases.sql` — phase column, second_half_started_at, derived status logic
10. `0006_standings_view.sql` — standings view
11. `0007_score_trigger.sql` — refresh_match_score function + triggers on match_events
12. Update `0001_init.sql` migrations carefully — DO NOT edit applied migrations; add new ones
13. Regenerate types: `npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" > types/database.ts`
14. Commit: "Schema: colors, photos, match phases, standings, score triggers"

### Phase 3 — Remove 3v3 specifics
15. Grep and replace all 3v3 mentions in code, copy, README
16. Remove any roster-size hardcoded validations
17. Commit: "Remove 3v3 format assumptions"

### Phase 4 — Team crest component & colors UI
18. Build `components/TeamCrest.tsx`
19. Update `/admin/teams` form with color pickers + live preview
20. Replace all places where team name was shown alone — add crest beside it
21. Commit: "Team crests with auto-generated SVG from colors"

### Phase 5 — Player photos
22. Build `PlayerAvatar` component with initials fallback
23. Update `/admin/players` with photo upload (client resize, server upload)
24. Show photos on `/players`, `/players/[id]`, in match feed (small)
25. Commit: "Player photos with Storage + fallback avatars"

### Phase 6 — Auto-draw system
26. Build `lib/draw.ts` with `distributeTeams` and `generateRoundRobin`
27. Build `components/DrawAnimation.tsx` with Framer Motion (`npm i framer-motion`)
28. Build `/admin/draw` page: input group count → animated draw → preview → confirm
29. Confirm action wipes existing groups/rounds/matches (with modal warning) and inserts new ones in a transaction
30. Commit: "Auto-draw with animation"

### Phase 7 — Schedule drag-and-drop
31. Install `@dnd-kit/core @dnd-kit/sortable`
32. Rename `/admin/rounds` to `/admin/schedule`, refactor to kanban-style columns
33. Drag a match → Server Action updates `matches.round_id`
34. Commit: "Drag-and-drop fixture reordering"

### Phase 8 — Match clock + phase state machine
35. Refactor `/admin/matches/[id]/live` with phase buttons (Pokreni mec / Kraj prvog / Pokreni drugo / Zavrsi mec)
36. Build `lib/matchClock.ts` with `getCurrentMinute`
37. Update public match page top to show large red live minute + phase label
38. Make event-entry form default minute to current match minute (overrideable)
39. Commit: "Match clock with 2×20 minute phases"

### Phase 9 — Event-driven scoring
40. Remove all admin UI fields/forms that edit `home_score` / `away_score` directly
41. Verify score is now always derived from events via trigger
42. Add validation: cannot finish a match if it has no kickoff timestamp
43. Commit: "Score is event-derived, no manual edits"

### Phase 10 — Standings auto-refresh
44. Update `/standings` to query the new `standings` view, joined with `teams` for names/crests
45. Add Supabase Realtime subscription on `matches` that refetches standings on change
46. Commit: "Standings auto-update from view + realtime"

### Phase 11 — Admin danger zone
47. Build `/admin/danger-zone/page.tsx` with reset button + modal
48. Wire the Server Action to call the same logic as `npm run reset`
49. Add link to danger zone from admin nav (red, bottom of sidebar)
50. Commit: "Admin reset UI"

### Phase 12 — Build & deploy
51. `npm run build` — must pass clean
52. Run `npm run reset` to start the deployed DB fresh
53. `git push origin iter2-format-overhaul`
54. `git checkout main && git merge iter2-format-overhaul && git push`
55. `npx vercel --prod --token "$VERCEL_TOKEN" --yes`
56. Verify deployed URL

### Phase 13 — Final
57. Update README with new admin workflow:
    1. Login as admin
    2. Add all teams (with colors)
    3. Add all players to teams (with photos)
    4. Go to `/admin/draw`, enter group count, run draw
    5. Confirm fixtures (optionally drag matches between kola via `/admin/schedule`)
    6. On matchday: open match, Pokreni mec, log events, Kraj prvog, Pokreni drugo, log events, Zavrsi mec
    7. Standings update automatically
    8. After group stage: configure knockout at `/admin/bracket`
58. Document `npm run reset` and `/admin/danger-zone` in README
59. Print final summary with live URL

---

## 4. Quality rules (carry over from iter 1, repeated for emphasis)

- No `any` in TypeScript
- All forms validated via Zod, client + server
- Mobile-first responsive — admin pages too (admin will use phone)
- Server Actions return `{ ok: true, data } | { ok: false, error: string }`
- Never expose service role key to client bundles
- All sensitive operations verify `profiles.role = 'admin'` server-side
- All migrations idempotent (`create ... if not exists`, `on conflict do nothing`)
- After `npm run reset`, the app must be fully usable from scratch — admin login still works, no broken FKs

---

## 5. Final deliverable checklist

- [ ] `npm run reset` works end-to-end (DB + auth users + storage cleared, admin preserved)
- [ ] `/admin/danger-zone` reset button works identically
- [ ] All 3v3 language removed from code and UI
- [ ] Team crests render everywhere a team is mentioned
- [ ] Player photos upload and display correctly with fallback
- [ ] `/admin/draw` runs animated draw → previews → commits fixtures
- [ ] `/admin/schedule` allows drag-and-drop reordering
- [ ] Match clock counts up live in red on `/matches/[id]`
- [ ] Score cannot be set without an event; every score change has a logged minute + player
- [ ] Standings refresh immediately when a match is marked finished
- [ ] `npm run build` passes
- [ ] Deployed to Vercel, live URL printed at the end
- [ ] README updated with new admin workflow + reset instructions

Begin now. Verify preconditions, then execute Phase 1.
