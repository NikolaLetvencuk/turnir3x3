# Turnir Kula

Full-stack web aplikacija za praćenje fudbalskog turnira u Kuli (Liparski put). Fleksibilan format (proizvoljan broj timova, igrača po timu i grupa). Public rezultati i tabele, fantasy liga sa privatnim ligama na poziv, live praćenje mečeva u realnom vremenu, admin panel za upravljanje celim turnirom.

## Live

- **Aplikacija:** https://turnir3x3.vercel.app
- **Admin panel:** https://turnir3x3.vercel.app/admin
- **Supabase dashboard:** `https://supabase.com/dashboard/project/<SUPABASE_PROJECT_REF>`

## Admin pristup

Email se nalazi u `.env.local` pod `ADMIN_EMAIL`, šifra pod `ADMIN_PASSWORD`. Login na `/auth/login`.

## Tehnologija

- Next.js 14 (App Router, TS strict, Tailwind)
- Supabase (Postgres + Auth + Realtime + Storage, free tier)
- Vercel (Hobby plan, free)
- Framer Motion (animacije žreba), @dnd-kit (drag-and-drop raspored)
- Zod + react-hook-form, lucide-react ikone, date-fns
- Validacija: Zod sheme, sve mutacije preko Server Actions

## Potrebni environment varijabli

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

Opcionalno (transakcioni email):

```
RESEND_API_KEY
RESEND_FROM_EMAIL
```

## Lokalni razvoj

```bash
npm install
cp .env .env.local   # popuni svoje vrednosti
npm run dev
```

Migracije:

```bash
npx supabase login --token "$SUPABASE_ACCESS_TOKEN"
npx supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
npx supabase db push
```

TS tipovi:

```bash
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" > types/database.ts
```

Admin user (idempotentno):

```bash
npm run seed:admin
```

Deploy:

```bash
npx vercel --prod --token "$VERCEL_TOKEN" --yes
```

## Database reset (HIGH PRIORITY ALAT)

Briše sve podatke turnira (timovi, igrači, mečevi, događaji, fantasy timovi, lige, snapshoti, bodovi, transferi, slike igrača) i sve korisnike osim admin naloga. Admin nalog ostaje aktivan.

CLI:

```bash
npm run reset           # interaktivno: traži da otkucaš RESET
npm run reset:force     # bez potvrde — koristi u CI ili kad si siguran
```

UI:

`/admin/danger-zone` → klikni „Resetuj sve" → otkucaj `RESETUJ` → potvrdi.

## Demo data

Brz start sa predefinisanim timovima i igračima:

```bash
npm run fresh             # reset + seed demo (preporučeno tokom razvoja)
# ili
npm run seed:demo         # seed na praznoj bazi (greška ako podaci već postoje)
npm run seed:demo:force   # obriši pa seed (bez potvrde)
```

Demo uključuje 4 tima: **Njukasl**, **Juventus**, **La Familia**, **Jasike** — sa njihovim rosterima i bojama (13 igrača ukupno).

Dostupno i u admin UI: `/admin/danger-zone` → „Učitaj demo" → izaberi „Učitaj na praznu bazu" ili „Resetuj pa učitaj".

## Admin workflow — pre sezone

1. **Login** kao admin na `/auth/login`
2. **Timovi** — `/admin/teams` — dodaj sve timove sa naslovom, skraćenicom i bojama (primarna + sekundarna). Grb se generiše automatski iz boja.
3. **Igrači** — `/admin/players` — dodaj igrače (proizvoljan broj po timu) sa opcionim fotografijama (klijent-side resize, JPEG ≤200KB). Bez polja „pozicija". Igrači se mogu dodavati i menjati u bilo kom trenutku turnira.
4. **Žreb** — `/admin/draw` — unesi broj grupa (2–8), pokreni animirani žreb, pregledaj raspored, potvrdi. Radi za bilo koji par (timovi, grupe) gde imaš najmanje 2 tima po grupi.
5. **Raspored** — `/admin/schedule` — prevuci mečeve između kola po potrebi.
6. **Nokaut kostur (opciono — bilo kad)** — `/admin/bracket` → izaberi koliko timova prolazi (2/4/8/16), koliko direktno po grupi, klikni „Generiši nokaut". Mečevi se kreiraju sa placeholder-ima (`A1`, `B2`, `W_QF_1`, `L_SF_1`...).

## Admin workflow — tokom turnira

Sa mobilnog telefona:

1. Otvori meč preko `/admin/matches` → `Otvori`
2. **Pokreni meč** — počinje prvo poluvreme, sat ide 1' → 20'
3. **Dodaj događaje** (gol, autogol, žuti, crveni) — minut se automatski popuni trenutnim vremenom meča, igrače biraš iz tima
4. **Kraj prvog poluvremena** — pauza
5. **Pokreni drugo poluvreme** — sat ide 21' → 40'
6. **Završi meč** — fantasy bodovi se preračunaju, tabela se ažurira u realnom vremenu

Sva pravila:
- Skor se NIKAD ne unosi ručno — derivira se iz logovanih događaja (DB trigger)
- Minut je obavezan za svaki događaj
- Meč ne može da se završi ako nije pokrenut
- Tabele se osvežavaju automatski preko Supabase Realtime

Nakon grupne faze:

7. `/admin/bracket` → klikni **„Zaključaj grupnu fazu"** — sistem rešava sve placeholder-e (A1, B2, BEST3_1...) u stvarne timove na osnovu tabela sa tiebreakerima (poeni, gol-razlika, golovi dati, head-to-head, disciplinski poeni). Ako neki meč nije završen, koristi **„Force lock"** sa upozorenjem.
8. Igraj nokaut mečeve. Svaki put kad meč završi:
   - Pobednik propagira u `W_<bracket_position>` slot
   - Gubitnik u `L_<bracket_position>` (za meč za 3. mesto)
   - Ako je izjednačeno: admin bira pobednika kroz dugmad **Penali / Produžeci**
9. Manuelni override: klik na bilo koji slot → dropdown sa svim timovima → izaberi tim. Manuelne dodele preživljavaju re-lock i re-resolve.

### Nokaut placeholderi

- `A1`, `B2`, `C3` — pozicija u grupi
- `BEST3_1`, `BEST3_2` — najbolji 3-plasirani po PPG-u (kada brojevi grupa nisu deljivi)
- `W_QF_1`, `W_SF_2`, `W_F` — pobednik prethodnog meča
- `L_SF_1`, `L_SF_2` — gubitnik (za meč za 3. mesto)

## Fantasy pravila

- 3 igrača po fantasy timu (ovo je gameplay odluka, ne tehnički limit)
- Bez budget cap-a (cena je informativna)
- Transferi samo izmedju kola; prvi besplatan, svaki sledeći −4 boda
- Lige preko 6-znakovnog invite koda (1/I i 0/O isključeni); neograničen broj liga po korisniku

Bodovanje:

| Događaj | Bodovi |
|---------|--------|
| Gol | +5 |
| Asistencija | +3 |
| Pobeda tima | +2 |
| Nerešeno | +1 |
| Čista mreža (0 primljenih) | +2 |
| Žuti karton | −1 |
| Crveni karton | −3 |
| Autogol | −2 |

## Arhitektura

```
app/
  (public)              — početna, standings (realtime), matches, players, bracket, fantasy landing
  auth/                 — login, register, verify, reset-password, callback
  fantasy/team/         — sastavi/izmeni svoj fantasy tim + istorija
  fantasy/leagues/      — kreiranje i pridruživanje preko koda + grid po kolu
  admin/
    teams               — CRUD + color pickers + crest preview
    players             — CRUD + photo upload
    draw                — auto-žreb sa animacijom
    schedule            — DnD raspored mečeva po kolima
    matches             — pregled svih mečeva
    matches/[id]/live   — live event entry + fazni state machine + 2×20 sat
    bracket             — eliminaciona faza
    fantasy             — manual recalc po kolu
    danger-zone         — reset svih podataka
lib/
  supabase/             — client / server / admin / middleware
  auth.ts               — getCurrentProfile, requireAdmin
  hooks/                — useRealtimeMatch
  standings.ts          — server-side agregacija (čita iz `standings` view-a)
  draw.ts               — Fisher-Yates + snake distribution + round-robin
  matchClock.ts         — getCurrentMinute, phaseLabel
  reset.ts              — zajednička reset rutina (CLI i UI dele)
components/
  TeamCrest             — SVG grb iz boja
  PlayerAvatar          — foto ili initials sa team-primary background
  admin/DrawAnimation   — Framer Motion ceremonija
supabase/migrations/    — 0001 init, 0002 realtime, 0003 trigger fix, 0004 reset RPC,
                          0005 colors, 0006 photos+storage, 0007 phases, 0008 standings view, 0009 score trigger
scripts/                — seed-admin.ts, push-vercel-env.ts, reset-db.ts
types/database.ts       — generisani Supabase tipovi
```

## Sigurnost

- RLS uključen na svim tabelama
- Service role ključ isključivo u `lib/supabase/admin.ts`
- Trigger blokira menjanje `profiles.role` van service-role konteksta
- Reset RPC `reset_tournament_data` revoke-ovan od `anon`/`authenticated` — zove samo service role
- Sve forme imaju Zod validaciju i server-side proveru
- Storage bucket `player-photos` je public za čitanje, upload samo preko admin server actiona
- Score je derived iz match_events preko DB trigger-a — nije moguće upisati direktno

## Build

`npm run build` mora da prođe bez TS i lint grešaka.
