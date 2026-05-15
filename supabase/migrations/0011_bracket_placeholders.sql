-- Nullable team IDs (placeholders allowed)
alter table public.matches alter column home_team_id drop not null;
alter table public.matches alter column away_team_id drop not null;

-- Placeholder strings (e.g. 'A1', 'B2', 'W_QF_1', 'L_SF_1', 'BEST3_1')
alter table public.matches add column if not exists home_placeholder text;
alter table public.matches add column if not exists away_placeholder text;

-- Knockout winner (manual or computed)
alter table public.matches add column if not exists knockout_winner_id uuid references public.teams(id);

-- Manual overrides (admin assignments persist across re-locks)
alter table public.matches add column if not exists home_team_id_manual uuid references public.teams(id);
alter table public.matches add column if not exists away_team_id_manual uuid references public.teams(id);

-- Ensure each slot has either a team or a placeholder
alter table public.matches drop constraint if exists matches_slots_specified;
alter table public.matches add constraint matches_slots_specified check (
  (home_team_id is not null or home_placeholder is not null or home_team_id_manual is not null)
  and (away_team_id is not null or away_placeholder is not null or away_team_id_manual is not null)
);

-- Singleton tournament_state
create table if not exists public.tournament_state (
  id boolean primary key default true check (id = true),
  group_stage_locked boolean not null default false,
  group_stage_locked_at timestamptz,
  advancing_per_group int,
  best_thirds int,
  include_third_place boolean not null default true
);
insert into public.tournament_state (id) values (true) on conflict (id) do nothing;

alter table public.tournament_state enable row level security;
drop policy if exists "tournament_state public read" on public.tournament_state;
create policy "tournament_state public read" on public.tournament_state for select using (true);

-- Re-grant standings to anon/authenticated (already set, but harmless)
grant select on public.standings to anon, authenticated;
