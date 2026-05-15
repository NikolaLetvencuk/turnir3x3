-- Add WHERE clause to tournament_state update in soft reset.
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
    public.player_prices,
    public.fantasy_league_members,
    public.fantasy_leagues,
    public.fantasy_teams,
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
        best_thirds = null
    where id = true;
end;
$$;
