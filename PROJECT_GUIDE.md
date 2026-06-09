# Turnir 3x3 — Project Guide

Read this first when opening the project in a new chat. It explains the stack,
how the app is structured, the branding system, and **how the per-tournament
logo variants are generated**.

---

## 1. What this is

A Next.js + Supabase web app for running a 3-a-side (3x3) football tournament:
team/player management, live group draw, fixtures & scheduling, live score/
event entry, standings, scorers, knockout bracket, news, social-media poster
export, and a daily fantasy game. Serbian (Latin) UI. Dark + gold theme.

Production: https://turnir3x3.vercel.app · GitHub: NikolaLetvencuk/turnir3x3

## 2. Stack

- **Next.js 14 (App Router, TypeScript)** — server components by default,
  server actions for mutations.
- **Supabase** — Postgres (+ RLS), Auth (email + Google), Storage (player
  photos, team crests, etc.), Realtime (live draw + live scores).
- **Tailwind** — dark theme; gold accent via a `gold` palette in
  `tailwind.config.ts` (the old `blue-*` classes are remapped to gold there).
- **Vercel** — hosting + analytics. `@vercel/og` (Satori) renders poster PNGs.
- Per-tournament model: **one deploy = one tournament** (see §6).

## 3. Layout of the code

- `app/` — routes. Public: `/`, `/matches`, `/standings`, `/bracket`,
  `/players`, `/vesti`, `/fantasy`, `/draw`. Admin under `app/admin/*`
  (teams, players, draw, matches [+schedule subtab], bracket, news, export,
  users, danger-zone). Auth under `app/auth/*`.
- `app/admin/actions.ts` — most admin server actions (teams, players, draw
  commit, scheduling/auto-fill, match flow, reset).
- `app/api/export/poster/route.tsx` — Edge route that renders all the
  social posters (results / standings / scorers / bracket / news) as PNGs.
- `lib/` — `supabase/` clients, `standings.ts`, `groupSorting.ts`,
  `bracket.ts` + `resolveBracket.ts`, `draw.ts`, `fantasy*.ts`, `reset.ts`,
  `brands.ts` + `brand-server.ts` (branding), `utils.ts` (Belgrade tz helpers).
- `components/` — `TeamCrest`, `PlayerAvatar`, `nav/*`, `matches/*`,
  `bracket/BracketTree`, `fantasy/PitchTeam`, `brand/*`, `admin/*`.
- `supabase/migrations/` — schema. Apply with `npx supabase db push
  --include-all` after linking the project. Latest: `0029_*`.

## 4. Key behaviors (gotchas)

- **Timezone**: everything day-based uses **Europe/Belgrade**. Match "day" =
  `(kickoff_at at time zone 'Europe/Belgrade')::date`.
- **Fantasy is per-DAY** (not per-round): users pick 3 players each day; group
  days require 3 different teams, QF+ days allow 2 from one team. Editable day
  = earliest day whose matches haven't started. Points via SQL triggers in
  `0027_fantasy_daily.sql`. League members' teams are hidden until that day's
  first match starts.
- **Scoring**: goal +3, assist +2, win +1, clean sheet +1, yellow −1, red −2,
  own goal −1. (Used in SQL, the fantasy popup, and player profile — keep them
  in sync.)
- **Draw** auto-commits to the DB when the animation finishes, then redirects
  admin to `/admin/matches`. Group letters come from `display_order` (A,B,…),
  not the group name.
- **Reset** (danger zone): soft reset clears fixtures + fantasy day data but
  keeps teams, players, users and leagues; full reset wipes everything incl.
  users + storage.
- **Scrollbars hidden** globally (globals.css); body has a faint gold logo
  watermark.

## 5. Branding system (demo vs clone)

See the two memories (`demo-branding-and-clone-model`,
`logo-variants-per-tournament`). Short version:

- `lib/brands.ts` — `Brand` type, `DEFAULT_BRAND` (**Krstur** — the demo/sales
  default; Kula/Petrovski is a named brand via `?t=petrovski`), `BRANDS` registry,
  `resolveBrand()`, `monogram()`, `DEMO_MODE` (`NEXT_PUBLIC_DEMO_MODE==="true"`).
- `lib/brand-server.ts` `getCurrentBrand()` reads the `brand` cookie (SSR).
- `app/brand-actions.ts` set/clear cookie; middleware handles `?t=Name`.
- `components/brand/BrandLogo` (image or monogram fallback) + `BrandPicker`.
- Wired into root layout (`generateMetadata`, TopNav, **body watermark** via
  the `--brand-watermark` CSS var = `brand.mark`), admin layout, homepage hero,
  and the **poster export route** (`brand.mark`, read from the `brand` cookie).
  Each brand carries `heroFrom`/`heroTo` (hero gradient) and `mark` (logo on
  dark surfaces: page watermark + posters). Gold accent elsewhere is global.
- **No manual switching / no popup.** The brand is set ONLY by opening a demo
  link `?t=<code>`. Middleware sets the `brand` cookie (on both request — so the
  same render is branded — and response, so it persists) and **keeps the `?t=`
  param** (no redirect). No cookie → Krstur default. No on-page switcher.
- **Social link previews are per-brand.** The homepage `generateMetadata` reads
  the brand from the `?t=` URL param (cookieless crawlers like Instagram/FB/
  WhatsApp can't read the cookie), so the shared link's title + preview image
  match the brand. Each brand has an `og` field (1200×630 image). Default falls
  back to the cookie. `brandMetadata()` (exported from `app/layout.tsx`) builds
  the title/desc/OG and is shared by the layout (cookie) and homepage (URL).
- In a **customer clone**, leave `NEXT_PUBLIC_DEMO_MODE` unset → `?t=` is
  ignored, the baked-in default brand only.

### Adding a brand (e.g. krstur-turnir)
1. Generate the logo variants (see §7) into `/public/brands/krstur/`
   (`nav.png` for navbar/admin, `hero.png` for the hero).
2. In `lib/brands.ts` add a row to `BRANDS` (uncomment the `krstur` example):
   set `name`, `shortName`, `kicker`, `navLogo`, `heroLogo`, and the brand
   colors `heroFrom`/`heroTo` (hex).
3. `git push` + redeploy. Send them the `code` ("krstur") to type in the
   popup, or a ready link `https://turnir3x3.vercel.app/?t=krstur`.

## 6. Deploying a new tournament

Full checklist in `DEPLOY_NEW_TOURNAMENT.md`. Summary: clone repo → new
Supabase project + `db push` → set 4 env vars (URL, anon, service_role,
ADMIN_EMAIL) → swap branding (logo folder + name) → new Vercel project + domain.

## 7. Logo asset pipeline (IMPORTANT)

Each tournament needs a **folder of logo variants**, generated from ONE source
logo the customer provides. For Petrovski Kula (in `/public/logo/`):

| File | What | How made |
|---|---|---|
| `logomkpetrovskibela_pozadina.png` | source: dark silhouette on white | given by user |
| `mkpetrovski.png` | transparent background | alpha = 255 − luminance |
| `mkpetrovski-gold.png` | gold (#d4af37) silhouette, transparent | recolor + alpha from luminance |
| `og-image.png` | 1200×630 social preview | dark gradient + gold logo + text |

For a new tournament, make `/public/brands/<code>/` with the same set. Use
**sharp** (installed via `npm i --no-save sharp` when running a one-off Node
script — it's not a runtime dep). Recipes:

**Transparent (white→alpha):**
```js
import sharp from "sharp";
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info, out = Buffer.alloc(width*height*4);
for (let i=0;i<width*height;i++){
  const r=data[i*4],g=data[i*4+1],b=data[i*4+2];
  const lum=0.2126*r+0.7152*g+0.0722*b;
  out[i*4]=0;out[i*4+1]=0;out[i*4+2]=0;out[i*4+3]=Math.round(255-lum);
}
await sharp(out,{raw:{width,height,channels:4}}).png().toFile("transparent.png");
```

**Gold silhouette** — same loop but set RGB to the brand color (`0xd4,0xaf,0x37`)
instead of `0,0,0`, alpha still `255 − luminance`.

**OG image (1200×630)** — compose a dark gradient background + the gold logo +
title text via an SVG overlay, e.g.:
```js
const logo = await sharp("gold.png").resize(280,280,{fit:"contain"}).png().toBuffer();
const svg = `<svg width="1200" height="630">...gradient + <text>NAZIV</text>...</svg>`;
await sharp(Buffer.from(svg)).composite([{input:logo, top:80, left:460}]).png().toFile("og-image.png");
```

Then point `lib/brands.ts` (navLogo/heroLogo) and the poster route
(`logoUrl`) + `app/layout.tsx` icons/OG at the new files. One-off scripts
should be deleted after running (they live at repo root temporarily, read
`.env.local` with a `\r?\n` split for Windows CRLF).

## 8. Conventions

- Commit, then `git push` (GitHub is the backup + clone source). Baseline tag:
  `v1.0-petrovski-baseline`.
- Migrations are idempotent (`create ... if not exists`, `drop policy if
  exists`). Apply with `npx supabase db push --include-all`.
- Build check before deploy: `npx tsc --noEmit` then `npx next build`, deploy
  `npx vercel deploy --prod --yes`.
