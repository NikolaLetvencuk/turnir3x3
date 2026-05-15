create or replace view public.standings as
with finished as (
  select m.*, r.stage from public.matches m
  join public.rounds r on r.id = m.round_id
  where m.phase = 'finished' and r.stage = 'group'
),
team_perspective as (
  select m.home_team_id as team_id, m.group_id, m.home_score as gf, m.away_score as ga
  from finished m
  where m.home_team_id is not null and m.away_team_id is not null
  union all
  select m.away_team_id as team_id, m.group_id, m.away_score as gf, m.home_score as ga
  from finished m
  where m.home_team_id is not null and m.away_team_id is not null
),
discipline as (
  select e.team_id,
    sum(case when e.event_type = 'yellow_card' then 1 else 0 end)::int as yellows,
    sum(case when e.event_type = 'red_card' then 1 else 0 end)::int as reds
  from public.match_events e
  group by e.team_id
)
select
  tp.team_id,
  tp.group_id,
  count(*)::int as played,
  sum(case when tp.gf > tp.ga then 1 else 0 end)::int as wins,
  sum(case when tp.gf = tp.ga then 1 else 0 end)::int as draws,
  sum(case when tp.gf < tp.ga then 1 else 0 end)::int as losses,
  sum(tp.gf)::int as goals_for,
  sum(tp.ga)::int as goals_against,
  (sum(tp.gf) - sum(tp.ga))::int as goal_diff,
  sum(case when tp.gf > tp.ga then 3 when tp.gf = tp.ga then 1 else 0 end)::int as points,
  case when count(*) > 0
    then (sum(case when tp.gf > tp.ga then 3 when tp.gf = tp.ga then 1 else 0 end)::numeric / count(*))
    else 0
  end as ppg,
  coalesce(d.yellows, 0)::int as yellow_cards,
  coalesce(d.reds, 0)::int as red_cards,
  (coalesce(d.yellows, 0) + coalesce(d.reds, 0) * 3)::int as discipline_points
from team_perspective tp
left join discipline d on d.team_id = tp.team_id
group by tp.team_id, tp.group_id, d.yellows, d.reds;

grant select on public.standings to anon, authenticated;

-- Head-to-head points: total points team_a earned in direct matches vs team_b
create or replace function public.h2h_points(p_team_a uuid, p_team_b uuid)
returns int
language sql
stable
as $$
  select coalesce(sum(
    case
      when (m.home_team_id = p_team_a and m.home_score > m.away_score) then 3
      when (m.away_team_id = p_team_a and m.away_score > m.home_score) then 3
      when m.home_score = m.away_score then 1
      else 0
    end
  ), 0)::int
  from public.matches m
  join public.rounds r on r.id = m.round_id
  where m.phase = 'finished' and r.stage = 'group'
    and ((m.home_team_id = p_team_a and m.away_team_id = p_team_b)
      or (m.home_team_id = p_team_b and m.away_team_id = p_team_a))
$$;

grant execute on function public.h2h_points(uuid, uuid) to anon, authenticated;
