-- Scoring v3:
--   goal:       +4 (was +3)
--   assist:     +2 (unchanged)
--   win:        +3 (was +1)
--   draw:       +1 (was 0)
--   loss:       -1 (new)
--   CS:         +3 (was +1)
--   yellow:     -1 (unchanged)
--   red:        -2 (unchanged)
--   own goal:   -1 (unchanged)

alter table public.fantasy_player_points add column if not exists losses int not null default 0;

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
      case when fm.home_score < fm.away_score then 1 else 0 end as loss,
      case when fm.away_score = 0 then 1 else 0 end as clean_sheet
    from finished_matches fm
    union all
    select fm.id, fm.away_team_id,
      case when fm.away_score > fm.home_score then 1 else 0 end,
      case when fm.home_score = fm.away_score then 1 else 0 end,
      case when fm.away_score < fm.home_score then 1 else 0 end,
      case when fm.home_score = 0 then 1 else 0 end
    from finished_matches fm
  ),
  team_agg as (
    select team_id,
      sum(win)::int as wins,
      sum(draw)::int as draws,
      sum(loss)::int as losses,
      sum(clean_sheet)::int as clean_sheets
    from team_results
    group by team_id
  )
  insert into public.fantasy_player_points
    (player_id, round_id, goals, assists, yellow_cards, red_cards, own_goals, wins, draws, losses, clean_sheets, total_points)
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
    coalesce(ta.losses, 0),
    coalesce(ta.clean_sheets, 0),
    coalesce(g.cnt, 0) * 4                  -- goal +4
      + coalesce(a.cnt, 0) * 2              -- assist +2
      + coalesce(ta.wins, 0) * 3            -- win +3
      + coalesce(ta.draws, 0) * 1           -- draw +1
      + coalesce(ta.losses, 0) * (-1)       -- loss -1
      + coalesce(ta.clean_sheets, 0) * 3    -- CS +3
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
