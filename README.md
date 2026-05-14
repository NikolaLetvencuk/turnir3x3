# Turnir Kula 3v3

Full-stack web aplikacija za praćenje 3v3 fudbalskog turnira u Kuli (Liparski put). Public rezultati i tabele, fantasy liga sa privatnim ligama na poziv, live praćenje mečeva u realnom vremenu, admin panel za upravljanje celim turnirom.

## Live

- **Aplikacija:** https://turnir3x3.vercel.app
- **Admin panel:** https://turnir3x3.vercel.app/admin
- **Supabase dashboard:** `https://supabase.com/dashboard/project/<SUPABASE_PROJECT_REF>`

## Admin pristup

Email se nalazi u `.env.local` pod `ADMIN_EMAIL`, šifra pod `ADMIN_PASSWORD`. Login na `/auth/login`.

## Tehnologija

- Next.js 14 (App Router, TS strict, Tailwind)
- Supabase (Postgres + Auth + Realtime, free tier)
- Vercel (Hobby plan, free)
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

Ako nema RESEND-a, koristi se Supabase ugrađeni mailer (rate-limited).

## Lokalni razvoj

```bash
npm install
cp .env .env.local   # popuni svoje vrednosti
npm run dev
```

Migracije se primenjuju sa:

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

## Admin workflow — pre sezone

1. **Login** kao admin na `/auth/login`
2. **Timovi** — `/admin/teams` — dodaj sve timove
3. **Igrači** — `/admin/players` — dodaj igrače i veži ih za timove
4. **Grupe** — `/admin/groups` — kreiraj grupe (A, B, ...) i dodeli timove
5. **Kola** — `/admin/rounds` — definiši sva kola unapred (grupna faza + eliminacije, naziv, faza, redosled, opcioni datum)
6. **Mečevi** — `/admin/matches` — kreiraj fixtures, dodeli ih kolima i grupama, postavi termin

## Admin workflow — tokom turnira

1. Pre meča: otvori meč na `/admin/matches/[id]/live`
2. **Go Live** — meč postaje uživo i kolo se aktivira (snapshoting fantasy timova)
3. Dok meč traje, dodaj događaje (golovi, asistencije, kartoni) — rezultat se automatski ažurira, fantasy bodovi se preračunavaju
4. Kad meč završi, klikni **Završi meč**
5. Kad sva mečeva u kolu završe, sistem automatski:
   - Računa konačne bodove za to kolo
   - Ažurira cene igrača za sledeće kolo (`new_price = 10.00 + 0.1 × ukupni bodovi do sada`, minimum 4.00)
   - Označava kolo kao završeno
6. Nakon grupne faze: `/admin/bracket` → kreiraj eliminacione mečeve

## Fantasy pravila

- 3 igrača po timu, bez budget cap-a (cena je informativna)
- Transferi samo izmedju kola; prvi transfer u kolu besplatan, svaki sledeći −4 boda
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
  (public)              — početna, standings, matches, players, bracket, fantasy landing
  auth/                 — login, register, verify, reset-password, callback
  fantasy/team/         — sastavi/izmeni svoj fantasy tim + istorija
  fantasy/leagues/      — kreiranje i pridruživanje preko koda + grid po kolu
  admin/                — sve admin CRUD stranice + live event entry
lib/
  supabase/             — client / server / admin / middleware varijante
  auth.ts               — getCurrentProfile, requireAdmin
  hooks/                — useRealtimeMatch
  standings.ts          — server-side agregacija tabela i top scorers
components/             — TopNav, BottomNav, ToastProvider, MatchCard, helperi
supabase/migrations/    — 0001 init (šema + funkcije + RLS), 0002 realtime, 0003 trigger fix
scripts/                — seed-admin.ts, push-vercel-env.ts
types/database.ts       — generisani Supabase tipovi
```

## Sigurnost

- RLS uključen na svim tabelama
- Service role ključ isključivo u `lib/supabase/admin.ts`, koristi se samo iz Server Actions i Route Handlers
- Trigger blokira menjanje `profiles.role` van service-role konteksta
- Fantasy team se ne može menjati kad postoji aktivno kolo (RLS policy + app-level provera)
- Sve forme imaju Zod validaciju i server-side proveru
- Realtime kanali (postgres_changes) su filtrirani po match_id na klijentu

## Build

`npm run build` mora da prođe bez TS i lint grešaka. CI je samo Vercelov default.
