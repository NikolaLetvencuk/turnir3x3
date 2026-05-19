-- Knockout matches that end tied can now go to two 5-minute extra-time halves
-- and then to a best-of-3 penalty shootout. We model it as two additional
-- phases on the existing matches row plus pen score columns.

alter table public.matches drop constraint if exists matches_phase_check;
alter table public.matches add constraint matches_phase_check
  check (phase in (
    'scheduled',
    'first_half',
    'halftime',
    'second_half',
    'extra_time',
    'penalties',
    'finished'
  ));

alter table public.matches
  add column if not exists home_pen smallint,
  add column if not exists away_pen smallint,
  add column if not exists extra_time_started_at timestamptz;

-- Status sync: any live-ish phase (incl. ET and penalties) maps to 'live'
create or replace function public.sync_match_status_from_phase()
returns trigger
language plpgsql
as $$
begin
  if new.phase = 'scheduled' then
    new.status := 'scheduled';
  elsif new.phase in ('first_half', 'halftime', 'second_half', 'extra_time', 'penalties') then
    new.status := 'live';
  elsif new.phase = 'finished' then
    new.status := 'finished';
  end if;
  return new;
end;
$$;
