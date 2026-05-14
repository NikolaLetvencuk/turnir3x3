-- =============================================
-- Tournament Manager — Turnir Kula 3v3
-- Initial schema, functions, triggers, RLS
-- =============================================

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

-- ---------- teams ----------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  logo_url text,
  created_at timestamptz not null default now()
);

-- ---------- players ----------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id uuid references public.teams(id) on delete set null,
  position text,
  created_at timestamptz not null default now()
);
create index if not exists players_team_id_idx on public.players(team_id);

-- ---------- groups ----------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order int not null default 0
);

-- ---------- group_teams ----------
create table if not exists public.group_teams (
  group_id uuid not null references public.groups(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (group_id, team_id),
  unique (team_id)
);
create index if not exists group_teams_group_id_idx on public.group_teams(group_id);
create index if not exists group_teams_team_id_idx on public.group_teams(team_id);

-- ---------- rounds ----------
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stage text not null check (stage in ('group','knockout')),
  display_order int not null,
  status text not null default 'upcoming' check (status in ('upcoming','active','finished')),
  starts_at timestamptz,
  locked_at timestamptz
);
create index if not exists rounds_status_idx on public.rounds(status);
create index if not exists rounds_display_order_idx on public.rounds(display_order);

-- ---------- matches ----------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete restrict,
  group_id uuid references public.groups(id) on delete set null,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  home_score int not null default 0,
  away_score int not null default 0,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished')),
  kickoff_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  bracket_position text,
  created_at timestamptz not null default now()
);
create index if not exists matches_round_id_idx on public.matches(round_id);
create index if not exists matches_group_id_idx on public.matches(group_id);
create index if not exists matches_home_team_idx on public.matches(home_team_id);
create index if not exists matches_away_team_idx on public.matches(away_team_id);
create index if not exists matches_status_idx on public.matches(status);
create index if not exists matches_kickoff_idx on public.matches(kickoff_at);

-- ---------- match_events ----------
create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  assist_player_id uuid references public.players(id) on delete set null,
  team_id uuid not null references public.teams(id),
  event_type text not null check (event_type in ('goal','own_goal','yellow_card','red_card')),
  minute int,
  created_at timestamptz not null default now()
);
create index if not exists match_events_match_idx on public.match_events(match_id);
create index if not exists match_events_player_idx on public.match_events(player_id);
create index if not exists match_events_assist_idx on public.match_events(assist_player_id);
create index if not exists match_events_team_idx on public.match_events(team_id);

-- ---------- fantasy_teams ----------
create table if not exists public.fantasy_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  player1_id uuid references public.players(id),
  player2_id uuid references public.players(id),
  player3_id uuid references public.players(id),
  updated_at timestamptz not null default now(),
  check (
    player1_id is null or player2_id is null or player3_id is null
    or (player1_id <> player2_id and player2_id <> player3_id and player1_id <> player3_id)
  )
);
create index if not exists fantasy_teams_user_idx on public.fantasy_teams(user_id);

-- ---------- fantasy_team_snapshots ----------
create table if not exists public.fantasy_team_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  player1_id uuid references public.players(id),
  player2_id uuid references public.players(id),
  player3_id uuid references public.players(id),
  transfers_used int not null default 0,
  transfer_penalty int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, round_id)
);
create index if not exists fantasy_snap_user_idx on public.fantasy_team_snapshots(user_id);
create index if not exists fantasy_snap_round_idx on public.fantasy_team_snapshots(round_id);

-- ---------- fantasy_player_points ----------
create table if not exists public.fantasy_player_points (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  goals int not null default 0,
  assists int not null default 0,
  yellow_cards int not null default 0,
  red_cards int not null default 0,
  own_goals int not null default 0,
  wins int not null default 0,
  draws int not null default 0,
  clean_sheets int not null default 0,
  total_points int not null default 0,
  unique (player_id, round_id)
);
create index if not exists fpp_player_idx on public.fantasy_player_points(player_id);
create index if not exists fpp_round_idx on public.fantasy_player_points(round_id);

-- ---------- fantasy_round_points ----------
create table if not exists public.fantasy_round_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  player1_points int not null default 0,
  player2_points int not null default 0,
  player3_points int not null default 0,
  transfer_penalty int not null default 0,
  total_points int not null default 0,
  unique (user_id, round_id)
);
create index if not exists frp_user_idx on public.fantasy_round_points(user_id);
create index if not exists frp_round_idx on public.fantasy_round_points(round_id);

-- ---------- fantasy_leagues ----------
create table if not exists public.fantasy_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists fl_owner_idx on public.fantasy_leagues(owner_id);

-- ---------- fantasy_league_members ----------
create table if not exists public.fantasy_league_members (
  league_id uuid not null references public.fantasy_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists flm_user_idx on public.fantasy_league_members(user_id);
create index if not exists flm_league_idx on public.fantasy_league_members(league_id);

-- ---------- player_transfers ----------
create table if not exists public.player_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id uuid references public.rounds(id),
  player_out_id uuid references public.players(id),
  player_in_id uuid references public.players(id),
  created_at timestamptz not null default now()
);
create index if not exists pt_user_idx on public.player_transfers(user_id);
create index if not exists pt_round_idx on public.player_transfers(round_id);

-- ---------- player_prices ----------
create table if not exists public.player_prices (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  price numeric(5,2) not null default 10.00,
  unique (player_id, round_id)
);
create index if not exists pp_player_idx on public.player_prices(player_id);
create index if not exists pp_round_idx on public.player_prices(round_id);

-- =============================================
-- FUNCTIONS
-- =============================================

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  exists_count int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    select count(*) into exists_count from public.fantasy_leagues where invite_code = candidate;
    exit when exists_count = 0;
  end loop;
  return candidate;
end;
$$;

-- Lock round: snapshot all teams + compute transfers/penalty for this round
create or replace function public.lock_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rounds
    set status = 'active', locked_at = coalesce(locked_at, now())
    where id = p_round_id and status <> 'finished';

  insert into public.fantasy_team_snapshots (user_id, round_id, player1_id, player2_id, player3_id, transfers_used, transfer_penalty)
  select
    ft.user_id,
    p_round_id,
    ft.player1_id,
    ft.player2_id,
    ft.player3_id,
    coalesce(t.cnt, 0),
    greatest(coalesce(t.cnt, 0) - 1, 0) * 4
  from public.fantasy_teams ft
  left join (
    select user_id, count(*)::int as cnt
    from public.player_transfers
    where round_id = p_round_id
    group by user_id
  ) t on t.user_id = ft.user_id
  on conflict (user_id, round_id) do nothing;
end;
$$;

-- Recalc player points for a round
create or replace function public.recalculate_player_points_for_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- delete existing for round so recompute is clean
  delete from public.fantasy_player_points where round_id = p_round_id;

  with finished_matches as (
    select m.id, m.home_team_id, m.away_team_id, m.home_score, m.away_score
    from public.matches m
    where m.round_id = p_round_id and m.status = 'finished'
  ),
  player_universe as (
    -- every player whose team played a finished match in this round
    select distinct p.id as player_id, p.team_id
    from public.players p
    join finished_matches fm on fm.home_team_id = p.team_id or fm.away_team_id = p.team_id
    where p.team_id is not null
  ),
  goals_by_player as (
    select e.player_id, count(*)::int as cnt
    from public.match_events e
    join public.matches m on m.id = e.match_id
    where m.round_id = p_round_id and m.status = 'finished' and e.event_type = 'goal'
    group by e.player_id
  ),
  assists_by_player as (
    select e.assist_player_id as player_id, count(*)::int as cnt
    from public.match_events e
    join public.matches m on m.id = e.match_id
    where m.round_id = p_round_id and m.status = 'finished' and e.event_type = 'goal' and e.assist_player_id is not null
    group by e.assist_player_id
  ),
  yellows_by_player as (
    select e.player_id, count(*)::int as cnt
    from public.match_events e
    join public.matches m on m.id = e.match_id
    where m.round_id = p_round_id and m.status = 'finished' and e.event_type = 'yellow_card'
    group by e.player_id
  ),
  reds_by_player as (
    select e.player_id, count(*)::int as cnt
    from public.match_events e
    join public.matches m on m.id = e.match_id
    where m.round_id = p_round_id and m.status = 'finished' and e.event_type = 'red_card'
    group by e.player_id
  ),
  owns_by_player as (
    select e.player_id, count(*)::int as cnt
    from public.match_events e
    join public.matches m on m.id = e.match_id
    where m.round_id = p_round_id and m.status = 'finished' and e.event_type = 'own_goal'
    group by e.player_id
  ),
  team_results as (
    select fm.id as match_id, fm.home_team_id as team_id,
      case when fm.home_score > fm.away_score then 1 else 0 end as win,
      case when fm.home_score = fm.away_score then 1 else 0 end as draw,
      case when fm.away_score = 0 then 1 else 0 end as clean_sheet
    from finished_matches fm
    union all
    select fm.id, fm.away_team_id,
      case when fm.away_score > fm.home_score then 1 else 0 end,
      case when fm.home_score = fm.away_score then 1 else 0 end,
      case when fm.home_score = 0 then 1 else 0 end
    from finished_matches fm
  ),
  team_agg as (
    select team_id,
      sum(win)::int as wins,
      sum(draw)::int as draws,
      sum(clean_sheet)::int as clean_sheets
    from team_results
    group by team_id
  )
  insert into public.fantasy_player_points
    (player_id, round_id, goals, assists, yellow_cards, red_cards, own_goals, wins, draws, clean_sheets, total_points)
  select
    pu.player_id,
    p_round_id,
    coalesce(g.cnt, 0),
    coalesce(a.cnt, 0),
    coalesce(y.cnt, 0),
    coalesce(r.cnt, 0),
    coalesce(o.cnt, 0),
    coalesce(ta.wins, 0),
    coalesce(ta.draws, 0),
    coalesce(ta.clean_sheets, 0),
    coalesce(g.cnt, 0) * 5
      + coalesce(a.cnt, 0) * 3
      + coalesce(ta.wins, 0) * 2
      + coalesce(ta.draws, 0) * 1
      + coalesce(ta.clean_sheets, 0) * 2
      + coalesce(y.cnt, 0) * (-1)
      + coalesce(r.cnt, 0) * (-3)
      + coalesce(o.cnt, 0) * (-2)
  from player_universe pu
  left join goals_by_player g on g.player_id = pu.player_id
  left join assists_by_player a on a.player_id = pu.player_id
  left join yellows_by_player y on y.player_id = pu.player_id
  left join reds_by_player r on r.player_id = pu.player_id
  left join owns_by_player o on o.player_id = pu.player_id
  left join team_agg ta on ta.team_id = pu.team_id;
end;
$$;

-- Recalc user points for a round (uses snapshots)
create or replace function public.recalculate_user_points_for_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fantasy_round_points where round_id = p_round_id;

  insert into public.fantasy_round_points
    (user_id, round_id, player1_points, player2_points, player3_points, transfer_penalty, total_points)
  select
    s.user_id,
    p_round_id,
    coalesce(p1.total_points, 0),
    coalesce(p2.total_points, 0),
    coalesce(p3.total_points, 0),
    s.transfer_penalty,
    (coalesce(p1.total_points, 0) + coalesce(p2.total_points, 0) + coalesce(p3.total_points, 0)) - s.transfer_penalty
  from public.fantasy_team_snapshots s
  left join public.fantasy_player_points p1 on p1.player_id = s.player1_id and p1.round_id = p_round_id
  left join public.fantasy_player_points p2 on p2.player_id = s.player2_id and p2.round_id = p_round_id
  left join public.fantasy_player_points p3 on p3.player_id = s.player3_id and p3.round_id = p_round_id
  where s.round_id = p_round_id;
end;
$$;

-- Public entry point: recompute everything for a round
create or replace function public.recalculate_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_player_points_for_round(p_round_id);
  perform public.recalculate_user_points_for_round(p_round_id);
end;
$$;

-- Update prices going into NEXT round
create or replace function public.update_player_prices(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_order int;
  v_next_round_id uuid;
begin
  select display_order into v_current_order from public.rounds where id = p_round_id;
  if v_current_order is null then return; end if;

  select id into v_next_round_id
  from public.rounds
  where display_order > v_current_order
  order by display_order asc
  limit 1;

  -- if no next round, store prices for current round (informational)
  if v_next_round_id is null then v_next_round_id := p_round_id; end if;

  insert into public.player_prices (player_id, round_id, price)
  select
    p.id,
    v_next_round_id,
    greatest(4.00, round((10.00 + 0.1 * coalesce(sum(fpp.total_points), 0))::numeric, 2))
  from public.players p
  left join public.fantasy_player_points fpp on fpp.player_id = p.id
  left join public.rounds r on r.id = fpp.round_id
  where r.display_order is null or r.display_order <= v_current_order
  group by p.id
  on conflict (player_id, round_id) do update set price = excluded.price;
end;
$$;

-- =============================================
-- TRIGGERS
-- =============================================

create or replace function public.trg_match_events_recalc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_id uuid;
begin
  if (tg_op = 'DELETE') then
    select round_id into v_round_id from public.matches where id = old.match_id;
  else
    select round_id into v_round_id from public.matches where id = new.match_id;
  end if;
  if v_round_id is not null then
    perform public.recalculate_round(v_round_id);
  end if;
  return null;
end;
$$;

drop trigger if exists match_events_recalc on public.match_events;
create trigger match_events_recalc
after insert or update or delete on public.match_events
for each row execute function public.trg_match_events_recalc();

create or replace function public.trg_matches_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unfinished int;
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    perform public.recalculate_round(new.round_id);
    select count(*) into v_unfinished
      from public.matches
      where round_id = new.round_id and status <> 'finished';
    if v_unfinished = 0 then
      perform public.update_player_prices(new.round_id);
      update public.rounds set status = 'finished' where id = new.round_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists matches_after_update on public.matches;
create trigger matches_after_update
after update on public.matches
for each row execute function public.trg_matches_after_update();

-- =============================================
-- RLS POLICIES
-- =============================================

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.groups enable row level security;
alter table public.group_teams enable row level security;
alter table public.rounds enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.fantasy_teams enable row level security;
alter table public.fantasy_team_snapshots enable row level security;
alter table public.fantasy_player_points enable row level security;
alter table public.fantasy_round_points enable row level security;
alter table public.fantasy_leagues enable row level security;
alter table public.fantasy_league_members enable row level security;
alter table public.player_transfers enable row level security;
alter table public.player_prices enable row level security;

-- Public-read tables
drop policy if exists "Public read teams" on public.teams;
create policy "Public read teams" on public.teams for select using (true);

drop policy if exists "Public read players" on public.players;
create policy "Public read players" on public.players for select using (true);

drop policy if exists "Public read groups" on public.groups;
create policy "Public read groups" on public.groups for select using (true);

drop policy if exists "Public read group_teams" on public.group_teams;
create policy "Public read group_teams" on public.group_teams for select using (true);

drop policy if exists "Public read rounds" on public.rounds;
create policy "Public read rounds" on public.rounds for select using (true);

drop policy if exists "Public read matches" on public.matches;
create policy "Public read matches" on public.matches for select using (true);

drop policy if exists "Public read match_events" on public.match_events;
create policy "Public read match_events" on public.match_events for select using (true);

drop policy if exists "Public read fantasy_player_points" on public.fantasy_player_points;
create policy "Public read fantasy_player_points" on public.fantasy_player_points for select using (true);

drop policy if exists "Public read player_prices" on public.player_prices;
create policy "Public read player_prices" on public.player_prices for select using (true);

-- profiles
drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles update own (no role change)" on public.profiles;
create policy "profiles update own (no role change)" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Prevent role escalation via trigger
create or replace function public.profiles_prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role <> old.role then
    raise exception 'role column may only be changed by service role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_role_change on public.profiles;
create trigger profiles_block_role_change
before update on public.profiles
for each row execute function public.profiles_prevent_role_change();

-- fantasy_teams: own row, edits blocked when an active round exists
drop policy if exists "fantasy_teams select own" on public.fantasy_teams;
create policy "fantasy_teams select own" on public.fantasy_teams for select using (auth.uid() = user_id);

drop policy if exists "fantasy_teams insert own (no active round)" on public.fantasy_teams;
create policy "fantasy_teams insert own (no active round)" on public.fantasy_teams
  for insert with check (
    auth.uid() = user_id
    and not exists (select 1 from public.rounds where status = 'active')
  );

drop policy if exists "fantasy_teams update own (no active round)" on public.fantasy_teams;
create policy "fantasy_teams update own (no active round)" on public.fantasy_teams
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and not exists (select 1 from public.rounds where status = 'active')
  );

drop policy if exists "fantasy_teams delete own" on public.fantasy_teams;
create policy "fantasy_teams delete own" on public.fantasy_teams for delete using (auth.uid() = user_id);

-- snapshots: any authenticated may read
drop policy if exists "fantasy_team_snapshots auth read" on public.fantasy_team_snapshots;
create policy "fantasy_team_snapshots auth read" on public.fantasy_team_snapshots
  for select using (auth.role() = 'authenticated');

-- fantasy_round_points: any authenticated may read
drop policy if exists "fantasy_round_points auth read" on public.fantasy_round_points;
create policy "fantasy_round_points auth read" on public.fantasy_round_points
  for select using (auth.role() = 'authenticated');

-- fantasy_leagues: owner or member can read
drop policy if exists "fantasy_leagues read owner or member" on public.fantasy_leagues;
create policy "fantasy_leagues read owner or member" on public.fantasy_leagues
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.fantasy_league_members m
      where m.league_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists "fantasy_leagues insert authenticated" on public.fantasy_leagues;
create policy "fantasy_leagues insert authenticated" on public.fantasy_leagues
  for insert with check (auth.uid() = owner_id);

drop policy if exists "fantasy_leagues update owner" on public.fantasy_leagues;
create policy "fantasy_leagues update owner" on public.fantasy_leagues
  for update using (owner_id = auth.uid());

drop policy if exists "fantasy_leagues delete owner" on public.fantasy_leagues;
create policy "fantasy_leagues delete owner" on public.fantasy_leagues
  for delete using (owner_id = auth.uid());

-- fantasy_league_members: a member can see all members of leagues they're in
drop policy if exists "fantasy_league_members read same league" on public.fantasy_league_members;
create policy "fantasy_league_members read same league" on public.fantasy_league_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.fantasy_league_members m2
      where m2.league_id = league_id and m2.user_id = auth.uid()
    )
  );

drop policy if exists "fantasy_league_members insert self" on public.fantasy_league_members;
create policy "fantasy_league_members insert self" on public.fantasy_league_members
  for insert with check (user_id = auth.uid());

drop policy if exists "fantasy_league_members delete self" on public.fantasy_league_members;
create policy "fantasy_league_members delete self" on public.fantasy_league_members
  for delete using (user_id = auth.uid());

-- player_transfers
drop policy if exists "player_transfers read own" on public.player_transfers;
create policy "player_transfers read own" on public.player_transfers for select using (user_id = auth.uid());

drop policy if exists "player_transfers insert own (no active round)" on public.player_transfers;
create policy "player_transfers insert own (no active round)" on public.player_transfers
  for insert with check (
    user_id = auth.uid()
    and not exists (select 1 from public.rounds where status = 'active')
  );

-- Auto-create profile row on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
