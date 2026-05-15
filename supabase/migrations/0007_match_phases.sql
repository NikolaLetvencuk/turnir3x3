-- Add phase column to matches; derive status from phase via trigger
alter table public.matches
  add column if not exists phase text not null default 'scheduled'
    check (phase in ('scheduled','first_half','halftime','second_half','finished'));

alter table public.matches
  add column if not exists second_half_started_at timestamptz;

-- Keep status in sync with phase (backwards compatibility for existing code paths)
create or replace function public.sync_match_status_from_phase()
returns trigger
language plpgsql
as $$
begin
  if new.phase = 'scheduled' then new.status := 'scheduled';
  elsif new.phase = 'first_half' or new.phase = 'halftime' or new.phase = 'second_half' then new.status := 'live';
  elsif new.phase = 'finished' then new.status := 'finished';
  end if;
  return new;
end;
$$;

drop trigger if exists matches_sync_status on public.matches;
create trigger matches_sync_status
before insert or update of phase on public.matches
for each row execute function public.sync_match_status_from_phase();

-- Backfill: any existing rows where status='live' default to first_half if no phase set yet (no-op given default)
update public.matches set phase = 'first_half' where status = 'live' and phase = 'scheduled';
update public.matches set phase = 'finished' where status = 'finished' and phase = 'scheduled';
