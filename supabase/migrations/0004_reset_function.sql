-- Server-side function to wipe all tournament data (admin user preserved)
create or replace function public.reset_tournament_data()
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
    public.groups,
    public.players,
    public.teams
  cascade;
end;
$$;

revoke all on function public.reset_tournament_data() from public;
revoke all on function public.reset_tournament_data() from anon, authenticated;
