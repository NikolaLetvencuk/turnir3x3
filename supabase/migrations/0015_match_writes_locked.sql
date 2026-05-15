-- Safety net: drop any authenticated-role write policies on matches.
-- Admin writes go through service role (which bypasses RLS).
-- After iter5.1, matches are created exclusively by the draw/bracket flows;
-- manual match create/delete UI and Server Actions are gone.
drop policy if exists "Admin insert matches" on public.matches;
drop policy if exists "Admin update matches" on public.matches;
drop policy if exists "Admin delete matches" on public.matches;
drop policy if exists "Authenticated insert matches" on public.matches;
drop policy if exists "Authenticated update matches" on public.matches;
drop policy if exists "Authenticated delete matches" on public.matches;
-- Public SELECT policy ("Public read matches") stays unchanged.
