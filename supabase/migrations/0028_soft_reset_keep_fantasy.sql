-- Soft reset rework: "Resetuj turnir (zadrži timove i igrače)" should ALSO
-- keep registered users and their fantasy teams/leagues/picks, so after the
-- reset the admin can re-run the draw and re-simulate fantasy with the same
-- people in place.
--
-- Cleared: matches, events, rounds, groups, draw/tournament state, and the
--          computed fantasy_day_points (they recompute as matches replay).
-- Kept:    teams, players, profiles, fantasy_teams, fantasy_leagues,
--          fantasy_league_members, fantasy_day_picks.

create or replace function public.reset_tournament_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Legacy fantasy tables (no longer used by the daily system, safe to clear)
  truncate table
    public.fantasy_round_points,
    public.fantasy_player_points,
    public.fantasy_team_snapshots,
    public.player_transfers,
    public.player_prices
  cascade;

  -- Computed daily points get wiped (recomputed by triggers on replay).
  -- Daily PICKS are kept so users' fantasy carries over.
  truncate table public.fantasy_day_points cascade;

  -- Tournament progress: matches, events, rounds, group assignments.
  truncate table
    public.match_events,
    public.matches,
    public.rounds,
    public.group_teams,
    public.groups
  cascade;

  -- Reset knockout config + group-stage lock.
  update public.tournament_state
    set group_stage_locked = false,
        group_stage_locked_at = null,
        advancing_per_group = null,
        best_thirds = null,
        include_third_place = true
    where id = true;

  -- Clear any scheduled/committed draw so a fresh draw can be run.
  -- per_pick_ms is NOT NULL — reset to its default rather than null.
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
