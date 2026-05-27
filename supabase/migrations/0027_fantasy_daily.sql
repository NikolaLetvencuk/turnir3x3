-- Fantasy rewrite: per-day picks instead of per-round picks. No prices, no
-- budget, no transfer penalties. User selects 3 players for each calendar
-- day (Belgrade local) and is scored based on whatever matches happen that
-- day. Old fantasy_teams / leagues stay as they are; this just adds the new
-- daily layer used by the new UI.

-- ---------- daily picks ----------
create table if not exists public.fantasy_day_picks (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  player1_id uuid not null references public.players(id) on delete restrict,
  player2_id uuid not null references public.players(id) on delete restrict,
  player3_id uuid not null references public.players(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  check (player1_id <> player2_id and player2_id <> player3_id and player1_id <> player3_id)
);
create index if not exists fdp_day_idx on public.fantasy_day_picks(day);

create table if not exists public.fantasy_day_points (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  player1_points int not null default 0,
  player2_points int not null default 0,
  player3_points int not null default 0,
  total_points int not null default 0,
  computed_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists fdpts_user_idx on public.fantasy_day_points(user_id);
create index if not exists fdpts_total_idx on public.fantasy_day_points(total_points desc);

-- ---------- RLS ----------
alter table public.fantasy_day_picks enable row level security;
alter table public.fantasy_day_points enable row level security;

drop policy if exists "fdp_read_all" on public.fantasy_day_picks;
create policy "fdp_read_all" on public.fantasy_day_picks for select using (true);

drop policy if exists "fdp_self_insert" on public.fantasy_day_picks;
create policy "fdp_self_insert" on public.fantasy_day_picks for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "fdp_self_update" on public.fantasy_day_picks;
create policy "fdp_self_update" on public.fantasy_day_picks for update
  to authenticated using (auth.uid() = user_id);

drop policy if exists "fdp_self_delete" on public.fantasy_day_picks;
create policy "fdp_self_delete" on public.fantasy_day_picks for delete
  to authenticated using (auth.uid() = user_id);

drop policy if exists "fdpts_read_all" on public.fantasy_day_points;
create policy "fdpts_read_all" on public.fantasy_day_points for select using (true);
-- writes via service role only

-- ---------- scoring helpers ----------
-- Scoring is the same as the existing round-based system:
--   goal +3, assist +2, win +1, draw 0, clean sheet +1,
--   yellow -1, red -2, own goal -1.
create or replace function public.player_points_for_day(p_player_id uuid, p_day date)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_goals int;
  v_assists int;
  v_yellows int;
  v_reds int;
  v_owns int;
  v_wins int;
  v_draws int;
  v_clean int;
begin
  select team_id into v_team_id from public.players where id = p_player_id;

  select coalesce(count(*),0)::int into v_goals
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.player_id = p_player_id
    and e.event_type = 'goal'
    and m.status = 'finished'
    and (m.kickoff_at at time zone 'Europe/Belgrade')::date = p_day;

  select coalesce(count(*),0)::int into v_assists
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.assist_player_id = p_player_id
    and e.event_type = 'goal'
    and m.status = 'finished'
    and (m.kickoff_at at time zone 'Europe/Belgrade')::date = p_day;

  select coalesce(count(*),0)::int into v_yellows
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.player_id = p_player_id
    and e.event_type = 'yellow_card'
    and m.status = 'finished'
    and (m.kickoff_at at time zone 'Europe/Belgrade')::date = p_day;

  select coalesce(count(*),0)::int into v_reds
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.player_id = p_player_id
    and e.event_type = 'red_card'
    and m.status = 'finished'
    and (m.kickoff_at at time zone 'Europe/Belgrade')::date = p_day;

  select coalesce(count(*),0)::int into v_owns
  from public.match_events e
  join public.matches m on m.id = e.match_id
  where e.player_id = p_player_id
    and e.event_type = 'own_goal'
    and m.status = 'finished'
    and (m.kickoff_at at time zone 'Europe/Belgrade')::date = p_day;

  -- Team-level: wins / draws / clean sheets for the player's team on this day
  if v_team_id is not null then
    select
      count(*) filter (
        where (m.home_team_id = v_team_id and m.home_score > m.away_score)
           or (m.away_team_id = v_team_id and m.away_score > m.home_score)
      )::int,
      count(*) filter (
        where (m.home_team_id = v_team_id or m.away_team_id = v_team_id)
          and m.home_score = m.away_score
      )::int,
      count(*) filter (
        where (m.home_team_id = v_team_id and m.away_score = 0)
           or (m.away_team_id = v_team_id and m.home_score = 0)
      )::int
    into v_wins, v_draws, v_clean
    from public.matches m
    where m.status = 'finished'
      and (m.kickoff_at at time zone 'Europe/Belgrade')::date = p_day
      and (m.home_team_id = v_team_id or m.away_team_id = v_team_id);
  else
    v_wins := 0; v_draws := 0; v_clean := 0;
  end if;

  return coalesce(v_goals,0) * 3
       + coalesce(v_assists,0) * 2
       + coalesce(v_wins,0) * 1
       + coalesce(v_draws,0) * 0
       + coalesce(v_clean,0) * 1
       - coalesce(v_yellows,0)
       - coalesce(v_reds,0) * 2
       - coalesce(v_owns,0);
end;
$$;

create or replace function public.recalculate_day_points(p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fantasy_day_points where day = p_day;

  insert into public.fantasy_day_points
    (user_id, day, player1_points, player2_points, player3_points, total_points)
  select
    fdp.user_id,
    fdp.day,
    public.player_points_for_day(fdp.player1_id, fdp.day),
    public.player_points_for_day(fdp.player2_id, fdp.day),
    public.player_points_for_day(fdp.player3_id, fdp.day),
    public.player_points_for_day(fdp.player1_id, fdp.day)
    + public.player_points_for_day(fdp.player2_id, fdp.day)
    + public.player_points_for_day(fdp.player3_id, fdp.day)
  from public.fantasy_day_picks fdp
  where fdp.day = p_day;
end;
$$;

-- ---------- triggers ----------
create or replace function public.fantasy_event_triggers_daily()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_day date;
begin
  v_match_id := coalesce(new.match_id, old.match_id);
  select (kickoff_at at time zone 'Europe/Belgrade')::date
  into v_day
  from public.matches where id = v_match_id;
  if v_day is not null then
    perform public.recalculate_day_points(v_day);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists daily_points_after_event on public.match_events;
create trigger daily_points_after_event
  after insert or update or delete on public.match_events
  for each row execute function public.fantasy_event_triggers_daily();

create or replace function public.fantasy_match_triggers_daily()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_old_day date;
begin
  v_day := (new.kickoff_at at time zone 'Europe/Belgrade')::date;
  v_old_day := (old.kickoff_at at time zone 'Europe/Belgrade')::date;

  -- Status or score change → recompute current day
  if new.status is distinct from old.status
     or new.home_score is distinct from old.home_score
     or new.away_score is distinct from old.away_score
  then
    if v_day is not null then perform public.recalculate_day_points(v_day); end if;
  end if;

  -- Kickoff moved to a different day → recompute both days
  if v_day is distinct from v_old_day then
    if v_day is not null then perform public.recalculate_day_points(v_day); end if;
    if v_old_day is not null then perform public.recalculate_day_points(v_old_day); end if;
  end if;

  return new;
end;
$$;

drop trigger if exists daily_points_after_match on public.matches;
create trigger daily_points_after_match
  after update on public.matches
  for each row execute function public.fantasy_match_triggers_daily();
