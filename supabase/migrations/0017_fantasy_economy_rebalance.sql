-- Gentler scoring (so a couple of goals don't dominate)
-- and delta-based price changes (price moves up OR down each round,
-- depending on player's points relative to a small baseline).

-- New scoring:
--   goal:        +3 (was +5)
--   assist:      +2 (was +3)
--   win:         +1 (was +2)
--   draw:         0 (was +1)
--   clean sheet: +1 (was +2)
--   yellow:      -1 (same)
--   red:         -2 (was -3)
--   own goal:    -1 (was -2)
create or replace function public.recalculate_player_points_for_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fantasy_player_points where round_id = p_round_id;

  with finished_matches as (
    select m.id, m.home_team_id, m.away_team_id, m.home_score, m.away_score
    from public.matches m
    where m.round_id = p_round_id and m.status = 'finished'
  ),
  player_universe as (
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
    coalesce(g.cnt, 0) * 3                  -- goal +3
      + coalesce(a.cnt, 0) * 2              -- assist +2
      + coalesce(ta.wins, 0) * 1            -- win +1
      + coalesce(ta.draws, 0) * 0           -- draw 0
      + coalesce(ta.clean_sheets, 0) * 1    -- CS +1
      + coalesce(y.cnt, 0) * (-1)           -- yellow -1
      + coalesce(r.cnt, 0) * (-2)           -- red -2
      + coalesce(o.cnt, 0) * (-1)           -- own goal -1
  from player_universe pu
  left join goals_by_player g on g.player_id = pu.player_id
  left join assists_by_player a on a.player_id = pu.player_id
  left join yellows_by_player y on y.player_id = pu.player_id
  left join reds_by_player r on r.player_id = pu.player_id
  left join owns_by_player o on o.player_id = pu.player_id
  left join team_agg ta on ta.team_id = pu.team_id;
end;
$$;


-- Delta-based pricing:
--   new_price = max(4, old_price + 0.05 * (round_points - 2))
--   • +10 points → +0.4M
--   • +5 points → +0.15M
--   • 0 points → -0.1M (slight depreciation)
--   • -2 points → -0.2M (cards hurt)
--   old_price = latest player_prices entry that applies to or before this round (default 10).
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

  -- If no next round, write to current round (final prices)
  if v_next_round_id is null then v_next_round_id := p_round_id; end if;

  insert into public.player_prices (player_id, round_id, price)
  select
    p.id,
    v_next_round_id,
    greatest(4.00,
      round(
        (coalesce(prev.price, 10.00) + 0.05 * (coalesce(fpp.total_points, 0) - 2))::numeric,
        2
      )
    )
  from public.players p
  left join lateral (
    select pp.price
    from public.player_prices pp
    join public.rounds rr on rr.id = pp.round_id
    where pp.player_id = p.id and rr.display_order <= v_current_order
    order by rr.display_order desc
    limit 1
  ) prev on true
  left join public.fantasy_player_points fpp on fpp.player_id = p.id and fpp.round_id = p_round_id
  on conflict (player_id, round_id) do update set price = excluded.price;
end;
$$;
