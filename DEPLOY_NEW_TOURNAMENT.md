# Pokretanje novog turnira (deploy za kupca)

Svaki turnir = **zaseban Supabase projekat** (svoji podaci) + **zaseban Vercel
projekat** (svoj domen). Kod je isti; menjaju se samo env varijable i branding
(logo + naziv). Ceo proces je ~20-30 min.

## 0. Klon koda
- Ako je na GitHub-u: `git clone <repo> turnir-<ime>` pa otvori folder.
- Ako iz arhive: raspakuj zip, pa `npm install`.

## 1. Supabase (baza za ovaj turnir)
1. https://supabase.com → New project (zapamti DB password).
2. Poveži lokalno: `npx supabase link --project-ref <ref>`
3. Primeni sve migracije: `npx supabase db push --include-all`
   - Ovo napravi sve tabele, RLS, funkcije, bucket-e iz `supabase/migrations/`.
4. Settings → API → kopiraj **Project URL**, **anon key**, **service_role key**.

## 2. Auth (login/registracija)
1. Authentication → URL Configuration → Site URL = finalni domen
   (npr. `https://turnir-becej.rs`), Redirect URLs: `https://.../**`.
2. (Opc.) Google login: Providers → Google → uključi + Client ID/Secret
   (Authorized redirect URI = `https://<ref>.supabase.co/auth/v1/callback`).
3. (Opc.) Email: Authentication → SMTP (Brevo) za potvrde naloga.

## 3. Env varijable
- Lokalno: kopiraj `.env.example` → `.env.local`, popuni 4 vrednosti.
- Postavi `ADMIN_EMAIL` na email osobe koja će biti admin.

## 4. Branding (logo + naziv)
- Zameni logo fajlove u `/public/logo/` (isti nazivi) ili dodaj nove i
  ažuriraj putanje.
- Naziv turnira: `app/layout.tsx` (`TITLE`, `DESC`, keywords) i hero tekst
  u `app/page.tsx`. (Kad demo-branding sloj bude gotov, ovo će biti jedan
  config umesto ručne izmene.)
- OG slika: `/public/og-image.png` (i `mkpetrovski-gold.png` za poster
  watermark) — zameni svojima.

## 5. Vercel deploy
1. `npx vercel link` (novi projekat) ili import repo-a na vercel.com.
2. Project → Settings → Environment Variables → dodaj ista 4 ključa.
3. `npx vercel deploy --prod --yes`.
4. Settings → Domains → dodaj kupljen domen, podesi DNS po Vercel uputstvu.

## 6. Prvi admin
1. Admin se registruje na sajtu (`/auth/register`) sa `ADMIN_EMAIL` email-om.
2. U Supabase: tabela `profiles` → njegov red → `role = admin` (ili je
   trigger već postavio ako ADMIN_EMAIL odgovara).
3. Admin uđe u `/admin` → unese timove/igrače → žreb → kreni.

## 7. Reset pred pravi start
- Ako je bilo test podataka: `/admin` → Opasna zona → "Resetuj turnir"
  (zadrži timove/igrače/korisnike) ili "Potpuni reset" za čisto.

---
**Napomena:** NIKAD ne deli `service_role` ključ niti `.env.local`. Svaki
turnir ima svoje ključeve — ne meša se baza između turnira.
