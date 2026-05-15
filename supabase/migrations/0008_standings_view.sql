create or replace view public.standings as
with finished_matches as (
  select id, group_id, home_team_id, away_team_id, home_score, away_score
  from public.matches
  where phase = 'finished'
),
team_results as (
  select home_team_id as team_id, group_id, home_score as gf, away_score as ga
  from finished_matches
  union all
  select away_team_id as team_id, group_id, away_score as gf, home_score as ga
  from finished_matches
)
select
  team_id,
  group_id,
  count(*)::int as played,
  sum(case when gf > ga then 1 else 0 end)::int as wins,
  sum(case when gf = ga then 1 else 0 end)::int as draws,
  sum(case when gf < ga then 1 else 0 end)::int as losses,
  sum(gf)::int as goals_for,
  sum(ga)::int as goals_against,
  (sum(gf) - sum(ga))::int as goal_diff,
  sum(case when gf > ga then 3 when gf = ga then 1 else 0 end)::int as points
from team_results
group by team_id, group_id;

grant select on public.standings to anon, authenticated;
