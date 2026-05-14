# Tournament Manager — Full Stack Web App (Autonomous Build & Deploy)

You are building and deploying a **fully functional, production-ready football tournament tracker** for a 3v3 tournament in Kula (Liparski put). The entire stack must be **free of charge**. You will execute this end-to-end autonomously — including deployment — and stop only if a credential is missing or a step fails irrecoverably.

---

## 0. Read credentials first

Before doing anything else, read `.env.local` from the current working directory. The following variables MUST be present. If any is missing, STOP and print a list of which ones are missing:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
SUPABASE_DB_PASSWORD
VERCEL_TOKEN
ADMIN_EMAIL
ADMIN_PASSWORD
```

Optional (use if present, skip gracefully if not):

```
RESEND_API_KEY
RESEND_FROM_EMAIL
GITHUB_TOKEN
```

Never log secret values to stdout. When echoing them into CLI tools, pipe via stdin.

---

## 1. Project context

- **Tournament format:** 3v3, no goalkeeper, played in Kula
- **Duration:** 2–4 weeks, daily activity expected
- **Structure:** Group stage (4–6 groups, 4–6 teams each, exact numbers configurable by admin) → knockout stage
- **Admin defines all matchday rounds (kola) upfront** at the start of the tournament; round schedule does not change during the group stage
- **UI language:** Serbian (Latin script) for all public-facing copy. Code, table names, and column names in English. Use `date-fns` with `sr-Latn` locale where possible; otherwise format manually (e.g. `dd.MM.yyyy. HH:mm`)
- **Timezone:** Europe/Belgrade for all date display
- **Mobile-first:** users will primarily check scores on phones

---

## 2. Tech stack (fixed — do not deviate)

- **Framework:** Next.js 14+ with App Router, TypeScript (strict), Tailwind CSS
- **Database + Auth + Realtime:** Supabase free tier
- **Email (transactional):** Resend if `RESEND_API_KEY` is set, otherwise Supabase built-in (rate-limited, acceptable fallback)
- **Deployment:** Vercel Hobby (free) — supports SSR, Server Actions, env vars for this exact use case
- **Validation:** Zod (shared client/server schemas)
- **Forms:** react-hook-form + `@hookform/resolvers/zod`
- **Icons:** lucide-react
- **Date utils:** date-fns

NPM packages to install:

```
@supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers lucide-react date-fns clsx tailwind-merge
```

Dev dependencies:

```
supabase tsx @types/node
```

---

## 3. User roles

### Public (unauthenticated)
Read-only access to:
- Live standings / league tables per group (P, W, D, L, GF, GA, GD, Pts)
- All match results and fixtures
- Top scorers leaderboard
- Individual player stats pages
- Group stage brackets
- Knockout bracket once published by admin
- Live match feed (goals, cards) in real time

### Registered user (email + password)
- Registration requires email verification before any fantasy action
- Full flow: register → email verify → login → password reset
- One **fantasy team** per account (exactly 3 players)
- Can edit team **only between rounds**, never during an active round
- Create or join unlimited **fantasy leagues** via 6-char invite code
- View own per-round point breakdown
- View other members' per-round breakdowns inside shared leagues

### Admin (hardcoded via env vars `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Admin panel at `/admin`, protected by role check (NOT just email match — use a `profiles.role` column)
- Full CRUD for teams, players, groups, rounds, matches, match events, knockout bracket
- Live match management: mark LIVE → log goals/cards in real time → mark FINISHED
- Manual fantasy points recalculation trigger

---

## 4. Database schema

Write all schema in `supabase/migrations/0001_init.sql`. Use snake_case, UUID primary keys (gen_random_uuid()), timestamps with timezone, foreign keys with appropriate ON DELETE behavior.

### Tables

**profiles** (extends auth.users)
- `id` uuid PK references auth.users(id) on delete cascade
- `email` text not null
- `role` text not null default 'user' check (role in ('user','admin'))
- `created_at` timestamptz default now()

**teams**
- `id` uuid PK
- `name` text not null unique
- `short_name` text
- `logo_url` text
- `created_at` timestamptz default now()

**players**
- `id` uuid PK
- `name` text not null
- `team_id` uuid references teams(id) on delete set null
- `position` text  -- optional, e.g. 'forward' / 'defender' for 3v3 it's loose
- `created_at` timestamptz default now()

**groups**
- `id` uuid PK
- `name` text not null  -- 'Grupa A', 'Grupa B', etc.
- `display_order` int not null default 0

**group_teams** (M:N for flexibility — a team belongs to one group at a time but this allows easy reassign)
- `group_id` uuid references groups(id) on delete cascade
- `team_id` uuid references teams(id) on delete cascade
- PK (group_id, team_id)
- unique (team_id)  -- enforce one group per team

**rounds**
- `id` uuid PK
- `name` text not null  -- 'Kolo 1', 'Kolo 2', 'Četvrtfinale', ...
- `stage` text not null check (stage in ('group','knockout'))
- `display_order` int not null
- `status` text not null default 'upcoming' check (status in ('upcoming','active','finished'))
- `starts_at` timestamptz
- `locked_at` timestamptz  -- when fantasy snapshots were taken

**matches**
- `id` uuid PK
- `round_id` uuid references rounds(id) on delete restrict
- `group_id` uuid references groups(id) on delete set null  -- null for knockout
- `home_team_id` uuid references teams(id)
- `away_team_id` uuid references teams(id)
- `home_score` int default 0
- `away_score` int default 0
- `status` text not null default 'scheduled' check (status in ('scheduled','live','finished'))
- `kickoff_at` timestamptz
- `started_at` timestamptz
- `finished_at` timestamptz
- `bracket_position` text  -- 'QF1','SF1','F','3RD' etc., null for group matches
- `created_at` timestamptz default now()

**match_events**
- `id` uuid PK
- `match_id` uuid references matches(id) on delete cascade
- `player_id` uuid references players(id) on delete restrict
- `assist_player_id` uuid references players(id) on delete set null
- `team_id` uuid references teams(id)  -- which team scored / received the card
- `event_type` text not null check (event_type in ('goal','own_goal','yellow_card','red_card'))
- `minute` int
- `created_at` timestamptz default now()

**fantasy_teams**
- `id` uuid PK
- `user_id` uuid references auth.users(id) on delete cascade unique
- `name` text  -- optional team name
- `player1_id` uuid references players(id)
- `player2_id` uuid references players(id)
- `player3_id` uuid references players(id)
- `updated_at` timestamptz default now()
- check (player1_id <> player2_id and player2_id <> player3_id and player1_id <> player3_id)

**fantasy_team_snapshots** (immutable record of what a user had when a round locked)
- `id` uuid PK
- `user_id` uuid references auth.users(id) on delete cascade
- `round_id` uuid references rounds(id) on delete cascade
- `player1_id` uuid references players(id)
- `player2_id` uuid references players(id)
- `player3_id` uuid references players(id)
- `transfers_used` int not null default 0  -- transfers made BEFORE this round
- `transfer_penalty` int not null default 0  -- (max(transfers_used - 1, 0)) * 4
- `created_at` timestamptz default now()
- unique (user_id, round_id)

**fantasy_player_points** (per player, per round, for breakdown views)
- `id` uuid PK
- `player_id` uuid references players(id) on delete cascade
- `round_id` uuid references rounds(id) on delete cascade
- `goals` int default 0
- `assists` int default 0
- `yellow_cards` int default 0
- `red_cards` int default 0
- `own_goals` int default 0
- `wins` int default 0
- `draws` int default 0
- `clean_sheets` int default 0
- `total_points` int default 0
- unique (player_id, round_id)

**fantasy_round_points** (per user, per round, after applying snapshot + penalty)
- `id` uuid PK
- `user_id` uuid references auth.users(id) on delete cascade
- `round_id` uuid references rounds(id) on delete cascade
- `player1_points` int default 0
- `player2_points` int default 0
- `player3_points` int default 0
- `transfer_penalty` int default 0
- `total_points` int default 0
- unique (user_id, round_id)

**fantasy_leagues**
- `id` uuid PK
- `name` text not null
- `invite_code` text not null unique  -- 6-char alphanumeric, uppercase
- `owner_id` uuid references auth.users(id) on delete cascade
- `created_at` timestamptz default now()

**fantasy_league_members**
- `league_id` uuid references fantasy_leagues(id) on delete cascade
- `user_id` uuid references auth.users(id) on delete cascade
- `joined_at` timestamptz default now()
- PK (league_id, user_id)

**player_transfers** (audit log)
- `id` uuid PK
- `user_id` uuid references auth.users(id) on delete cascade
- `round_id` uuid references rounds(id)  -- round this transfer counts AGAINST (the next active round)
- `player_out_id` uuid references players(id)
- `player_in_id` uuid references players(id)
- `created_at` timestamptz default now()

**player_prices**
- `id` uuid PK
- `player_id` uuid references players(id) on delete cascade
- `round_id` uuid references rounds(id) on delete cascade  -- price valid starting this round
- `price` numeric(5,2) not null default 10.00
- unique (player_id, round_id)

### Indexes
Add indexes on every foreign key column and on `matches.status`, `matches.kickoff_at`, `rounds.status`, `rounds.display_order`.

### Database functions (PL/pgSQL)

**`generate_invite_code()` returns text**
Loop generating 6-char uppercase alphanumeric (exclude ambiguous: 0/O, 1/I) until unique in `fantasy_leagues.invite_code`.

**`lock_round(p_round_id uuid)` returns void**
1. Set `rounds.status = 'active'`, `locked_at = now()` for the given round
2. For every row in `fantasy_teams` where all 3 player slots are non-null:
   - Insert into `fantasy_team_snapshots` (user_id, round_id, player1/2/3_id)
   - Compute `transfers_used` = count of `player_transfers` rows for this user with `round_id = p_round_id`
   - `transfer_penalty` = greatest(transfers_used - 1, 0) * 4
3. Idempotent (ON CONFLICT DO NOTHING on snapshot insert)

**`recalculate_player_points_for_round(p_round_id uuid)` returns void**
For every player who appeared in any FINISHED match in this round:
- Goals: count match_events where event_type='goal' and player_id = X and match in round
- Assists: count match_events where assist_player_id = X
- Yellow/red cards: count
- Own goals: count
- Wins/draws: determine from match result vs player's team (look up via `players.team_id`)
- Clean sheet: count of matches in round where player's team conceded 0 (and match is finished)
- Total: goals*5 + assists*3 + wins*2 + draws*1 + clean_sheets*2 + yellow*(-1) + red*(-3) + own_goals*(-2)
- UPSERT into `fantasy_player_points`

**`recalculate_user_points_for_round(p_round_id uuid)` returns void**
For each snapshot in this round:
- Fetch player1/2/3 points from `fantasy_player_points`
- total = sum of 3 - transfer_penalty
- UPSERT into `fantasy_round_points`

**`recalculate_round(p_round_id uuid)` returns void**
Calls both functions above in order. This is the public entry point.

**`update_player_prices(p_round_id uuid)` returns void**
After a round finishes, for every player:
- Compute total accumulated points across all rounds up to and including p_round_id
- `new_price = 10.00 + (total * 0.1)`, floor at 4.00
- Insert into `player_prices` for round_id = next round (or same round if it's the last)

### Triggers

- After INSERT/UPDATE/DELETE on `match_events` → call `recalculate_round(round_id of match)` for the affected round
- After UPDATE on `matches` when status changes to 'finished' → call `recalculate_round(round_id)`; if ALL matches in round are finished, call `update_player_prices(round_id)` and set `rounds.status = 'finished'`

### Row Level Security

Enable RLS on all tables.

**Public SELECT** (USING true) on: teams, players, groups, group_teams, rounds, matches, match_events, fantasy_player_points, player_prices

**profiles**:
- SELECT: own row OR authenticated
- INSERT: own row (`auth.uid() = id`)
- UPDATE: own row, but `role` column not updatable by user (use a trigger or split into separate column-level policy)

**fantasy_teams**:
- SELECT: own row; also readable when joined via snapshots (handled at app layer — RLS just allows own)
- INSERT/UPDATE: own row, AND only if no round currently has status='active' (enforce in policy with EXISTS check on rounds)
- DELETE: own row

**fantasy_team_snapshots**: SELECT allowed to any authenticated user (needed for league viewing), INSERT only via service role
**fantasy_round_points**: SELECT allowed to any authenticated user, INSERT/UPDATE only via service role
**fantasy_leagues**: SELECT if owner OR member; INSERT by authenticated; UPDATE/DELETE by owner only
**fantasy_league_members**: SELECT if user is member of same league (use EXISTS subquery); INSERT own row with valid invite code (validate in Server Action, not RLS)
**player_transfers**: SELECT own; INSERT own when no active round
**Admin writes:** ALL writes to teams/players/groups/rounds/matches/match_events go through Server Actions using SUPABASE_SERVICE_ROLE_KEY after verifying caller is admin via `profiles.role = 'admin'`. Do NOT rely on RLS for admin authorization — use service role + app-level check.

---

## 5. Fantasy system rules (exact specification)

### Team composition
- Exactly 3 players. UI must prevent saving with fewer or duplicates.
- No budget cap — pricing is informational only (used for "value" sorting and future analytics)

### Round lock & snapshots
- When admin marks the FIRST match of a round as LIVE (status → 'live'), OR explicitly clicks "Activate Round", call `lock_round(round_id)`.
- All current `fantasy_teams` are snapshotted at that moment.
- Snapshots are immutable.
- Users with incomplete teams (< 3 players) at lock time get a snapshot with NULLs and score 0 for that round.

### Transfers
- Allowed only when no round has status='active'.
- A "transfer" = changing ANY one of the 3 player slots between two saves.
- Counted per round: every time a user changes their team while a future round is the "next upcoming round", increment `player_transfers` for that round.
- First transfer of a round: free. Each additional: −4 pts penalty applied to that round's `fantasy_round_points.transfer_penalty`.
- Penalty is finalized at lock time and stored in the snapshot.

### Scoring (per player per match, summed across all matches in a round)

| Event                                  | Points |
|----------------------------------------|--------|
| Goal scored                            | +5     |
| Assist                                 | +3     |
| Win (player's team won)                | +2     |
| Draw                                   | +1     |
| Clean sheet (team conceded 0)          | +2     |
| Yellow card                            | −1     |
| Red card                               | −3     |
| Own goal                               | −2     |

Note: in 3v3 no-goalkeeper format, clean sheet bonus goes to ALL players of the team that kept the clean sheet.

### Pricing
- Base price: 10.00
- After each finished round: `new_price = 10.00 + 0.1 × (sum of player's total_points across all rounds so far)`, floored at 4.00
- `player_prices` row inserted for the NEXT round (so price is set going into the next round)
- For round 1, every player is 10.00

### Leagues
- Any authenticated user can create a league (provide name); system generates unique 6-char code.
- Other users join by entering code. Validation: code exists, user not already a member.
- League standings = sum of all `fantasy_round_points.total_points` for each member, sorted descending.
- User can be in unlimited leagues; their fantasy team and points are shared across all leagues.

---

## 6. Real-time features

- Use Supabase Realtime subscriptions on `matches` and `match_events` only.
- Reusable hook `useRealtimeMatch(matchId)` returning current match state + event list.
- Homepage and `/matches` show live matches with pulsing 🔴 LIVE badge.
- `/matches/[id]` displays: large scoreline, chronological event feed (`⚽ 14' Marko Jović (FC Kula)` / `🟨 22' Nemanja Petrić`), both team lineups.
- Realtime channel: `realtime:public:matches` and `realtime:public:match_events` filtered server-side by match where possible.
- No polling. No external WebSocket provider.

---

## 7. Pages / routes

### Public
- `/` — Live matches (top), upcoming fixtures, recent results, top 3 of standings, top 5 scorers, CTA to fantasy
- `/standings` — All groups, full tables
- `/matches` — All matches, filterable by round/group/status, default view: next round + live
- `/matches/[id]` — Single match with live feed
- `/players` — All players, sortable by goals/assists/cards/price
- `/players/[id]` — Player profile with full stat breakdown
- `/bracket` — Knockout bracket (visual)
- `/fantasy` — Marketing landing for fantasy + login/register CTA

### Auth
- `/auth/register`
- `/auth/login`
- `/auth/verify` — landing after email confirmation
- `/auth/reset-password` — request and reset flows
- `/auth/callback` — Supabase OAuth callback

### Authenticated user
- `/fantasy/team` — pick/edit 3 players; shows current prices, prevents save during active round, displays "X transfers used (next will cost 4 pts)"
- `/fantasy/team/history` — round-by-round breakdown of own snapshots & points
- `/fantasy/leagues` — list of joined leagues, create new, join by code
- `/fantasy/leagues/[id]` — league standings + round-by-round grid (rows = members, columns = rounds + total). Cell click → modal with that user's snapshot for that round + per-player point breakdown + penalty.

### Admin (`/admin/*`, role check via middleware)
- `/admin` — dashboard: upcoming matches, current round status, recent events
- `/admin/teams` — CRUD teams
- `/admin/players` — CRUD players, assign team
- `/admin/groups` — create groups, assign teams (drag-and-drop or select)
- `/admin/rounds` — define all rounds upfront (name, stage, order, optional starts_at)
- `/admin/matches` — fixtures CRUD, mark LIVE / log goals & cards / mark FINISHED
- `/admin/matches/[id]/live` — dedicated live event entry screen
- `/admin/bracket` — after group stage, configure knockout bracket
- `/admin/fantasy` — button to manually trigger `recalculate_round(round_id)` for any round

---

## 8. Architectural conventions

- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — server component client (cookies)
- `lib/supabase/admin.ts` — service role client, never imported into client components
- `lib/supabase/middleware.ts` — for `middleware.ts` to refresh sessions
- `middleware.ts` — refresh auth + protect `/admin/*` and `/fantasy/*` routes
- All mutations via **Server Actions** in `app/**/actions.ts` files
- Always verify admin role inside admin Server Actions before service-role calls
- Use `revalidatePath` / `revalidateTag` after mutations
- Server Components by default, `'use client'` only for forms, realtime hooks, interactive UI
- Strict TypeScript, no `any`, generate Supabase types via `npx supabase gen types typescript --local > types/database.ts`
- All forms: Zod schema → react-hook-form → Server Action returning `{ ok: boolean, error?: string }`
- Error boundaries on each route segment
- Loading skeletons via `loading.tsx`
- Toast notifications (build a minimal client-side toast — no extra library)

---

## 9. EXECUTION WORKFLOW (mandatory, ordered)

Execute these phases in order. After each phase, print a one-line status. On any failure, STOP and print the failing step number + error + recovery hint.

### Phase 1 — Bootstrap
1. Verify `.env.local` exists and all required vars are set
2. Verify Node ≥ 18 (`node -v`)
3. `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --no-git`
   (run inside current dir; if prompted, accept defaults; if dir not empty due to `.env.local`, that's fine — proceed)
4. `git init && git add -A && git commit -m "Initial Next.js scaffold"`
5. Install runtime deps:
   ```
   npm i @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers lucide-react date-fns clsx tailwind-merge
   ```
6. Install dev deps:
   ```
   npm i -D supabase tsx
   ```

### Phase 2 — Supabase setup
7. `npx supabase login --token "$SUPABASE_ACCESS_TOKEN"` (read from env)
8. `npx supabase init` — accept defaults
9. `npx supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"`
10. Write `supabase/migrations/0001_init.sql` containing the entire schema, functions, triggers, and RLS policies from Section 4
11. Write `supabase/migrations/0002_realtime.sql`:
    ```sql
    alter publication supabase_realtime add table matches;
    alter publication supabase_realtime add table match_events;
    ```
12. `npx supabase db push` — verify success
13. Generate types: `npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" > types/database.ts`

### Phase 3 — Application code
14. Build out all routes, components, Server Actions, hooks per Sections 7 and 8
15. Create a clean Tailwind design system — neutral palette (zinc) + one accent (emerald). Mobile-first. Card-based layouts. Subtle borders, no heavy shadows. Sticky bottom nav on mobile for: Home / Standings / Matches / Fantasy / Profile.
16. Implement `useRealtimeMatch` hook
17. Implement all admin pages with proper forms
18. Implement the fantasy league round-by-round grid with clickable cells → modal breakdown

### Phase 4 — Admin seed
19. Write `scripts/seed-admin.ts`:
    - Uses `SUPABASE_SERVICE_ROLE_KEY` to call `supabase.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true })`
    - On conflict (user exists), fetch the user instead
    - Upsert into `profiles` with `role = 'admin'`
20. Run: `npx tsx scripts/seed-admin.ts`

### Phase 5 — Email (if RESEND_API_KEY present)
21. Use Supabase Management API to set SMTP:
    ```
    PATCH https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth
    Authorization: Bearer $SUPABASE_ACCESS_TOKEN
    Body: { "smtp_host":"smtp.resend.com", "smtp_port":465, "smtp_user":"resend", "smtp_pass":"$RESEND_API_KEY", "smtp_sender_email":"$RESEND_FROM_EMAIL", "smtp_sender_name":"Turnir Kula", "smtp_admin_email":"$RESEND_FROM_EMAIL" }
    ```
22. If this fails (plan restriction or 4xx), print exact dashboard steps and continue without blocking

### Phase 6 — Local build verification
23. `npm run build` — must pass with no type errors
24. Fix any TS / build errors before continuing

### Phase 7 — Deploy
25. `npm i -D vercel`
26. `npx vercel link --yes --token "$VERCEL_TOKEN"` — creates Vercel project linked to current dir
27. For each variable in `.env.local`, push to Vercel:
    ```
    echo "$VALUE" | npx vercel env add VAR_NAME production --token "$VERCEL_TOKEN"
    ```
    (script this in a loop reading from `.env.local`, skip empty values, skip `VERCEL_*` itself)
28. Deploy: `npx vercel --prod --token "$VERCEL_TOKEN" --yes` — capture URL from stdout
29. Update Supabase Auth redirect URLs to include the Vercel domain via Management API:
    ```
    PATCH /v1/projects/$SUPABASE_PROJECT_REF/config/auth
    Body: { "site_url": "<vercel_url>", "uri_allow_list": "<vercel_url>/**" }
    ```

### Phase 8 — Verify
30. `curl -I <vercel_url>` — expect 200
31. `curl -I <vercel_url>/admin` — expect 307/302 redirect to login
32. Write `README.md` containing:
    - Live URL
    - Admin login credentials
    - Supabase dashboard URL
    - Required env vars list (names only, no values)
    - First-season admin workflow:
      1. Login as admin at `/auth/login`
      2. Go to `/admin/teams` — create all teams
      3. `/admin/players` — add players to teams
      4. `/admin/groups` — create groups, assign teams
      5. `/admin/rounds` — define all matchday rounds for group stage
      6. `/admin/matches` — create fixtures, assign to rounds
      7. On matchday: open match → Go Live → log events → Finish
      8. After group stage: `/admin/bracket` → configure knockout
33. Final commit: `git add -A && git commit -m "Production-ready deploy"`
34. If `GITHUB_TOKEN` is set and `gh` is available, create remote repo and push

### Phase 9 — Final summary
35. Print to user:
    - 🟢 LIVE URL: `https://...vercel.app`
    - 🔑 Admin email: `$ADMIN_EMAIL`
    - 🔑 Admin password: (do not print — instruct user to use their `.env.local` value)
    - 🗄️ Supabase dashboard: `https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF`
    - 📋 Next steps: link to README

---

## 10. Error handling & quality rules

- All scripts idempotent — re-running the full workflow must not duplicate data
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client bundles (only in `lib/supabase/admin.ts`, only imported from Server Actions / Route Handlers)
- Validate ALL inputs server-side, even if validated client-side
- All Server Actions return discriminated unions `{ ok: true, data } | { ok: false, error: string }`
- Recalculation must be atomic per round — wrap in transaction inside SQL function
- For race conditions (two admins logging same event): rely on UUIDs + ordered timestamps, no special locking needed at this scale
- All dates stored in UTC, displayed in Europe/Belgrade
- No console.log in production code (use a tiny `log` util that no-ops in prod)
- Accessibility: semantic HTML, labels on all inputs, sufficient contrast (Tailwind defaults pass WCAG AA when used correctly)

---

## 11. Final deliverable checklist

- [ ] Deployed publicly accessible Vercel URL
- [ ] Admin can log in at `/admin` and enter teams/players/rounds/matches
- [ ] Public can view standings, results, live scores without auth
- [ ] Users can register, verify email, build fantasy team, join leagues via invite code
- [ ] Live match feed updates in real time across all connected clients
- [ ] Fantasy points recalculate automatically when events are logged
- [ ] Round-by-round league grid with clickable per-user breakdowns works
- [ ] README.md committed with all setup info and admin workflow
- [ ] No TypeScript errors, `npm run build` passes

Begin now. Read `.env.local`, then proceed through Phase 1.
