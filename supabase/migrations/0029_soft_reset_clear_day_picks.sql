-- Refine soft reset: also clear the per-day fantasy PICKS, not just the
-- computed points. After a soft reset the old fixtures are gone, so any
-- daily lineups tied to old match dates are meaningless (they'd show up as
-- "0 points" on dates with no games). Users rebuild their daily teams against
-- the fresh schedule.
--
-- Still kept: registered users, fantasy_teams (name/identity),
--             fantasy_leagues, fantasy_league_members.

create or replace function public.reset_tournament_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table
    public.fantasy_round_points,
    public.fantasy_player_points,
    public.fantasy_team_snapshots,
    public.player_transfers,
    public.player_prices
  cascade;

  -- Daily fantasy data tied to the (now deleted) fixtures.
  truncate table public.fantasy_day_points cascade;
  truncate table public.fantasy_day_picks cascade;

  truncate table
    public.match_events,
    public.matches,
    public.rounds,
    public.group_teams,
    public.groups
  cascade;

  update public.tournament_state
    set group_stage_locked = false,
        group_stage_locked_at = null,
        advancing_per_group = null,
        best_thirds = null,
        include_third_place = true
    where id = true;

  update public.draw_state
    set state = 'idle',
        scheduled_at = null,
        per_pick_ms = 5000,
        group_count = null,
        result = null,
        updated_at = now()
    where id = true;
end;
$$;
