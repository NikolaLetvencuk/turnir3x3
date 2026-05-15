# Tournament Manager — Iteration 3.1 (Demo Seed Script)

Add a demo seed script that populates the database with a predefined set of teams and players. This is a small focused addition to the existing project.

Branch: `git checkout -b iter3.1-demo-seed` (or stay on main if iter3 is merged)

---

## 1. What to build

### 1.1 The data

Four teams with two colors each (for the crest), and their players:

```typescript
const DEMO_DATA = [
  {
    name: 'Njukasl',
    short_name: 'NJK',
    primary_color: '#000000',   // crna
    secondary_color: '#FFFFFF', // bela
    players: [
      'Miloš Ničetin',
      'Vukašin Patković',
      'Uroš Sisarica',
      'Nikola Letvenčuk',
    ],
  },
  {
    name: 'Juventus',
    short_name: 'JUV',
    primary_color: '#FFFFFF', // bela
    secondary_color: '#000000', // crna
    players: [
      'Mario Mandžukić',
      'Miralem Pjanić',
      'Marko Pjaca',
    ],
  },
  {
    name: 'La Familia',
    short_name: 'LAF',
    primary_color: '#1E40AF', // plava
    secondary_color: '#000000', // crna
    players: [
      'Stefan Hardi 1',
      'Stefan Hardi 2',
      'Stefan Hardi 3',
    ],
  },
  {
    name: 'Jasike',
    short_name: 'JAS',
    primary_color: '#15803D', // zelena
    secondary_color: '#FFFFFF', // bela
    players: [
      'Čelavi Šmarac 1',
      'Čelavi Šmarac 2',
      'Čelavi Šmarac 3',
    ],
  },
];
```

**Important — preserve diacritics exactly as written**: Ničetin, Patković, Letvenčuk, Mandžukić, Pjanić, Šmarac. UTF-8 source file, no escaping.

### 1.2 Script file

Create `scripts/seed-demo.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const DEMO_DATA = [ /* as above */ ];

async function main() {
  const force = process.argv.includes('--force');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Safety: check if teams already exist
  const { count } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true });

  if ((count ?? 0) > 0 && !force) {
    console.error(`❌ Found ${count} existing teams. Run with --force to wipe and re-seed, or run \`npm run reset:force\` first.`);
    process.exit(1);
  }

  if (force && (count ?? 0) > 0) {
    console.log('⚠️  --force flag set, wiping existing data first...');
    const { error: resetErr } = await supabase.rpc('reset_tournament_data');
    if (resetErr) {
      console.error('Reset failed:', resetErr);
      process.exit(1);
    }
    console.log('✓ Existing data wiped');
  }

  console.log('Seeding demo data...');

  for (const team of DEMO_DATA) {
    // Insert team
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

    if (teamErr || !teamRow) {
      console.error(`Failed to insert team ${team.name}:`, teamErr);
      process.exit(1);
    }

    // Insert players for this team
    const playerRows = team.players.map(name => ({
      name,
      team_id: teamRow.id,
    }));

    const { error: playersErr } = await supabase
      .from('players')
      .insert(playerRows);

    if (playersErr) {
      console.error(`Failed to insert players for ${team.name}:`, playersErr);
      process.exit(1);
    }

    console.log(`✓ ${team.name} (${team.players.length} igrača)`);
  }

  console.log(`\n🎉 Demo seed complete: ${DEMO_DATA.length} timova, ${DEMO_DATA.reduce((a, t) => a + t.players.length, 0)} igrača`);
  console.log(`\nSledeći koraci:`);
  console.log(`  1. Otvori /admin/draw u browseru`);
  console.log(`  2. Izaberi 2 grupe (za 4 tima → 2 po grupi)`);
  console.log(`  3. Pokreni žreb`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
```

### 1.3 `package.json` scripts

Add:
```json
"scripts": {
  "seed:demo": "tsx scripts/seed-demo.ts",
  "seed:demo:force": "tsx scripts/seed-demo.ts --force",
  "fresh": "npm run reset:force && npm run seed:demo"
}
```

The `npm run fresh` combo is the killer feature — wipes everything and reseeds demo data in one command. Document this in README.

### 1.4 Admin UI button

In `/admin/danger-zone/page.tsx`, add a second card below the reset card:

**"Učitaj demo podatke"** card:
- Yellow/amber color (not red — this is less destructive than reset)
- Description: "Učitava 4 demo tima (Njukasl, Juventus, La Familia, Jasike) sa igračima. Koristiti samo na praznoj bazi ili u kombinaciji sa resetom."
- Button: **"Učitaj demo"** → modal with "Učitaj na praznu bazu" vs "Resetuj pa učitaj" options
- Both options call a Server Action that runs the same logic as the CLI script
- Server Action verifies admin role, then calls `seedDemoData(force: boolean)` from shared `lib/seed.ts`

Extract the seeding logic into `lib/seed.ts` so both CLI and UI call the same function:

```typescript
// lib/seed.ts
import { SupabaseClient } from '@supabase/supabase-js';

export const DEMO_DATA = [ /* ... */ ];

export async function seedDemoData(supabase: SupabaseClient, force: boolean) {
  // ... same logic, returns { teamsInserted: number, playersInserted: number }
}
```

The CLI script imports from `lib/seed.ts`. The Server Action does the same with the admin client.

### 1.5 Crest verification

After seeding, manually verify the crests render correctly in the UI. Especially:
- Juventus has white as primary — white crest on white background will be invisible. The `TeamCrest` component should already handle contrast, but verify. If not, add a subtle gray border around any crest where primary_color is too light (luminance > 0.85).

---

## 2. Execution order

1. Create `lib/seed.ts` with `DEMO_DATA` and `seedDemoData` function
2. Create `scripts/seed-demo.ts` that imports from `lib/seed.ts`
3. Update `package.json` with three new scripts
4. Update `/admin/danger-zone` page with demo seed card
5. Wire Server Action for the UI button
6. Test CLI flow:
   ```bash
   npm run reset:force
   npm run seed:demo
   # verify 4 teams + 13 players visible in /admin/teams and /admin/players
   ```
7. Test combined flow:
   ```bash
   # add some garbage data via UI
   npm run fresh
   # verify only demo data remains
   ```
8. Test UI flow:
   - Go to `/admin/danger-zone`
   - Click "Učitaj demo" → "Resetuj pa učitaj"
   - Verify toast success and data appears
9. Verify Juventus crest is visible (contrast fix if needed)
10. `npm run build` — must pass
11. Commit: "Add demo seed script (Njukasl, Juventus, La Familia, Jasike)"
12. Deploy: `npx vercel --prod --token "$VERCEL_TOKEN" --yes`

---

## 3. README update

Add a section under "Development":

```markdown
## Demo data

Quick start with predefined teams and players:

\`\`\`bash
npm run fresh   # reset + seed demo (use during development)
# or
npm run seed:demo         # seed on empty DB (errors if data exists)
npm run seed:demo:force   # wipe and re-seed (no confirmation prompt)
\`\`\`

Demo includes 4 teams: Njukasl, Juventus, La Familia, Jasike — with their respective player rosters and colors.

Also available via admin UI at `/admin/danger-zone`.
```

---

## 4. Checklist

- [ ] `lib/seed.ts` has `DEMO_DATA` constant and `seedDemoData` function with proper diacritics preserved
- [ ] `scripts/seed-demo.ts` works with `--force` flag
- [ ] `npm run seed:demo`, `npm run seed:demo:force`, `npm run fresh` all work
- [ ] `/admin/danger-zone` has demo seed card with confirm modal
- [ ] UI seed action verifies admin role server-side
- [ ] All team crests render with adequate contrast (Juventus white-primary verified)
- [ ] README updated
- [ ] Build passes
- [ ] Deployed

Begin now.
