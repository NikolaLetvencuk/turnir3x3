# Tournament Manager — Iteration 4.1 (Soft Reset & Photo Preservation)

Small but high-impact update: the default reset should preserve teams, players, and uploaded photos. Only tournament progress (matches, events, fantasy, draw) gets wiped.

Branch: `git checkout -b iter4.1-soft-reset`

---

## 1. Problem statement

Currently `npm run reset` wipes everything — including teams, players, and the player-photos Storage bucket. Re-uploading photos through the admin UI every time we test is painful.

**New behavior:**
- **Soft reset (default)** — wipes only "tournament progress" (matches, events, groups, draw, fantasy state, tournament_state, non-admin auth users). Keeps teams, players, their `photo_url` references, and the entire Storage bucket.
- **Full reset (opt-in)** — current nuclear behavior, but enhanced to preserve photos across re-seeding via name matching.

---

## 2. Detailed changes

### 2.1 New DB function for soft reset

**Migration** (`supabase/migrations/0013_soft_reset.sql`):

```sql
-- Soft reset: keep teams, players, photo_url; wipe progress only
create or replace function reset_tournament_progress() returns void as $$
begin
  -- Order matters due to foreign keys
  truncate table 
    fantasy_day_picks,
    fantasy_day_points,
    fantasy_user_state,
    player_daily_prices,
    player_daily_points,
    fantasy_league_members,
    fantasy_leagues,
    match_events,
    matches,
    group_teams,
    groups
  cascade;
  
  -- Reset singleton state
  update tournament_state 
    set group_stage_locked = false, group_stage_locked_at = null;
end;
$$ language plpgsql security definer;

revoke all on function reset_tournament_progress() from public;
```

**Note:** The existing `reset_tournament_data()` function from iter2 still exists and is the nuclear option. It additionally truncates `players` and `teams`. Leave it as-is.

### 2.2 Update CLI reset script

Modify `scripts/reset-db.ts` to support both modes:

```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import readline from 'readline';

config({ path: '.env.local' });

const full = process.argv.includes('--full');
const yes = process.argv.includes('--yes') || process.argv.includes('--force');

async function main() {
  const mode = full ? 'FULL' : 'PROGRESS';
  const description = full
    ? 'wipe EVERYTHING including teams, players, photos, and auth users'
    : 'wipe matches/events/fantasy/draw, KEEP teams/players/photos';

  if (!yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>(r =>
      r(`This will ${description}.\nType ${mode} to confirm: `)
    );
    rl.close();
    if (answer !== mode) {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (full) {
    // FULL reset: wipe data + non-admin users + storage
    const { error } = await supabase.rpc('reset_tournament_data');
    if (error) { console.error('DB reset failed:', error); process.exit(1); }
    console.log('✓ Full data wiped (teams, players, all progress)');

    // Wipe non-admin auth users
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const adminEmail = process.env.ADMIN_EMAIL!;
    for (const u of users?.users ?? []) {
      if (u.email !== adminEmail) {
        await supabase.auth.admin.deleteUser(u.id);
      }
    }
    console.log('✓ Non-admin auth users wiped');

    // Wipe storage
    const { data: folders } = await supabase.storage.from('player-photos').list('', { limit: 10000 });
    if (folders?.length) {
      const paths: string[] = [];
      for (const folder of folders) {
        const { data: inner } = await supabase.storage.from('player-photos').list(folder.name, { limit: 1000 });
        inner?.forEach(f => paths.push(`${folder.name}/${f.name}`));
      }
      if (paths.length) await supabase.storage.from('player-photos').remove(paths);
    }
    console.log('✓ Storage wiped');
  } else {
    // SOFT reset: wipe progress, keep teams/players/photos/storage
    const { error } = await supabase.rpc('reset_tournament_progress');
    if (error) { console.error('Soft reset failed:', error); process.exit(1); }
    console.log('✓ Tournament progress wiped (teams/players/photos preserved)');

    // Still wipe non-admin auth users (test accounts)
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const adminEmail = process.env.ADMIN_EMAIL!;
    let removed = 0;
    for (const u of users?.users ?? []) {
      if (u.email !== adminEmail) {
        await supabase.auth.admin.deleteUser(u.id);
        removed++;
      }
    }
    console.log(`✓ ${removed} test auth users wiped`);
  }

  // Always verify admin profile
  const { data: { users: postUsers } } = await supabase.auth.admin.listUsers();
  const admin = postUsers?.find(u => u.email === process.env.ADMIN_EMAIL);
  if (admin) {
    await supabase.from('profiles').upsert({
      id: admin.id,
      email: process.env.ADMIN_EMAIL!,
      role: 'admin'
    });
  }

  console.log(`\n🎉 ${mode === 'FULL' ? 'Full' : 'Soft'} reset complete.`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

### 2.3 Update seed script with photo preservation

Modify `scripts/seed-demo.ts` and `lib/seed.ts` to back up photo_urls by player name before wiping, then restore them after re-insertion:

```typescript
// lib/seed.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export const DEMO_DATA = [
  // ... (unchanged from iter3.1)
];

export async function seedDemoData(supabase: SupabaseClient, force: boolean) {
  const { count } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true });

  let photoBackup = new Map<string, string>();

  if ((count ?? 0) > 0) {
    if (!force) {
      throw new Error(`Found ${count} existing teams. Use force=true to wipe and re-seed.`);
    }
    
    // Back up photo URLs by player NAME (resilient to UUID changes on re-insert)
    const { data: existingPlayers } = await supabase
      .from('players')
      .select('name, photo_url')
      .not('photo_url', 'is', null);

    if (existingPlayers) {
      for (const p of existingPlayers) {
        if (p.photo_url) photoBackup.set(p.name, p.photo_url);
      }
    }
    console.log(`📸 Backed up ${photoBackup.size} player photo URLs`);

    // Nuclear data wipe (but storage is untouched — photos remain on disk)
    const { error } = await supabase.rpc('reset_tournament_data');
    if (error) throw error;
  }

  let teamsInserted = 0;
  let playersInserted = 0;
  let photosRestored = 0;

  for (const team of DEMO_DATA) {
    const { data: teamRow, error: teamErr } = await supabase
      .from('teams')
      .insert({
        name: team.name,
        short_name: team.short_name,
        primary_color: team.primary_color,
        secondary_color: team.secondary_color,
      })
      .select('id')
      .single();

    if (teamErr || !teamRow) throw teamErr ?? new Error(`Failed inserting team ${team.name}`);
    teamsInserted++;

    const playerRows = team.players.map(name => ({
      name,
      team_id: teamRow.id,
      photo_url: photoBackup.get(name) ?? null,
    }));

    const { error: playersErr } = await supabase.from('players').insert(playerRows);
    if (playersErr) throw playersErr;

    playersInserted += playerRows.length;
    photosRestored += playerRows.filter(p => p.photo_url).length;
  }

  return { teamsInserted, playersInserted, photosRestored };
}
```

Update the CLI seed script (`scripts/seed-demo.ts`) to print the photosRestored count:

```typescript
const result = await seedDemoData(supabase, force);
console.log(`✓ ${result.teamsInserted} timova, ${result.playersInserted} igrača`);
if (result.photosRestored > 0) {
  console.log(`✓ ${result.photosRestored} slika igrača restaurirano`);
}
```

### 2.4 Update package.json scripts

Replace the scripts block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  
  "reset": "tsx scripts/reset-db.ts",
  "reset:force": "tsx scripts/reset-db.ts --yes",
  "reset:full": "tsx scripts/reset-db.ts --full",
  "reset:full:force": "tsx scripts/reset-db.ts --full --yes",
  
  "seed:demo": "tsx scripts/seed-demo.ts",
  "seed:demo:force": "tsx scripts/seed-demo.ts --force",
  "seed:demo:full": "tsx scripts/seed-demo.ts --full",
  
  "fresh": "npm run reset:force",
  "fresh:full": "npm run reset:full:force && npm run seed:demo:force"
}
```

**Naming convention:**
- `reset` (alone) = soft reset (keeps teams/players/photos)
- `reset:full` = nuclear
- `fresh` = soft reset only (no re-seed needed since teams/players survive)
- `fresh:full` = nuclear + re-seed with photo restoration by name

### 2.5 Update admin UI danger zone

Modify `/admin/danger-zone/page.tsx` to have **three cards** instead of two:

**Card 1 — Reset progress (amber/yellow)** [DEFAULT, recommended]
- Title: "Resetuj turnir (zadrži timove i igrače)"
- Description: "Briše mečeve, događaje, žreb, grupnu fazu i fantasy podatke. Timovi, igrači i njihove slike ostaju. Korisno za ponovno testiranje."
- Button: "Resetuj turnir"
- Modal: type `RESETUJ` to confirm
- Calls Server Action that runs `reset_tournament_progress()` RPC + wipes non-admin auth users

**Card 2 — Full reset (red)** [DESTRUCTIVE]
- Title: "Potpuni reset"
- Description: "Briše SVE — timove, igrače, slike, sve. Koristiti samo ako je baza u nekonzistentnom stanju."
- Button: "Potpuni reset"
- Modal: type `IZBRISI SVE` to confirm
- Calls Server Action that runs `reset_tournament_data()` + wipes non-admin users + wipes storage bucket

**Card 3 — Seed demo (blue)** [SETUP]
- Title: "Učitaj demo podatke"
- Description: "Učitava 4 demo tima sa igračima. Ako već postoje, slike se zadržavaju i restauriraju po imenu igrača."
- Button: "Učitaj demo"
- Modal: simple confirm
- Server Action calls `seedDemoData(supabase, force=true)` from `lib/seed.ts`

The cards visually progress from "safe" (amber) to "destructive" (red) to "setup" (blue). Document each clearly so the right one is obvious.

### 2.6 README update

Replace the "Database reset" section:

```markdown
## Resetovanje baze

Tri nivoa resetovanja, po destruktivnosti:

| Komanda | Šta zadržava | Šta briše | Kada koristiti |
|---------|--------------|-----------|----------------|
| `npm run reset` | Timovi, igrači, slike | Mečevi, događaji, fantasy, žreb | Posle svakog testa |
| `npm run reset:full` | Samo admin nalog | Sve, uključujući slike | Kad baza puca |
| `npm run fresh:full` | Samo admin nalog | Sve, ali odmah re-seeduje demo timove (slike se restauriraju po imenu igrača ako su bile uploadovane) | Čist start |

Tipičan razvojni tok:

1. **Prvi put:** `npm run fresh:full` → otvori `/admin/players` → uploaduj slike za svakog igrača
2. **Tokom testiranja:** `npm run reset` → mečevi/događaji obrisani, ali timovi i slike ostaju
3. **Ako baza puca:** `npm run fresh:full` → potpuni reset, slike se restauriraju jer su demo imena fiksna

Sve dostupno i kroz admin UI na `/admin/danger-zone`.
```

---

## 3. Execution order

1. Migration `0013_soft_reset.sql` — add `reset_tournament_progress()` function
2. Update `scripts/reset-db.ts` with `--full` flag and dual behavior
3. Update `lib/seed.ts` with photo URL backup/restore logic
4. Update `scripts/seed-demo.ts` to print restored photo count
5. Update `package.json` scripts (new naming)
6. Update `/admin/danger-zone` with three cards
7. Update README
8. Test sequence:
   ```bash
   npm run fresh:full              # nuclear + seed
   # → open /admin/players, upload one photo manually for one player
   npm run reset                   # soft reset
   # → verify: matches gone, but player still has photo
   npm run fresh:full              # full re-seed
   # → verify: photo still appears (restored by name match)
   ```
9. `npm run build`
10. Commit: "Soft reset preserves teams, players, and photos"
11. Deploy

---

## 4. Checklist

- [ ] `reset_tournament_progress()` function added, only truncates progress tables
- [ ] `npm run reset` = soft reset (default)
- [ ] `npm run reset:full` = nuclear
- [ ] `npm run fresh` = soft reset (no re-seed needed)
- [ ] `npm run fresh:full` = nuclear + seed with photo restoration
- [ ] Seed script backs up `photo_url` by player name before wiping
- [ ] Seed script restores `photo_url` to matching player names on re-insert
- [ ] Storage bucket files NEVER wiped by soft reset
- [ ] Storage bucket files NEVER wiped by seed (only by `reset:full`)
- [ ] Admin UI has three distinctly-colored cards (amber/red/blue)
- [ ] Each UI card calls the correct underlying logic
- [ ] README updated with reset matrix table
- [ ] Photo persists through soft reset (manual test)
- [ ] Photo persists through `fresh:full` via name matching (manual test)
- [ ] Build passes, deployed

Begin now.
