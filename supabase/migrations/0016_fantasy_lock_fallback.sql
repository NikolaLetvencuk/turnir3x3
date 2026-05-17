-- New lock_round semantics:
--   • User explicitly locks team for an upcoming round via lockTeamForUpcomingRound action.
--   • When the round becomes 'active', for any user who has NO snapshot for that round,
--     copy their most recent earlier snapshot (so missing locks fall back to previous team).
--   • Users without any earlier snapshot get no row (zero points).
-- Transfers feature is effectively disabled (penalty = 0).

create or replace function public.lock_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_order int;
  v_prev_round uuid;
begin
  update public.rounds
    set status = 'active', locked_at = coalesce(locked_at, now())
    where id = p_round_id and status <> 'finished';

  select display_order into v_current_order from public.rounds where id = p_round_id;
  if v_current_order is null then return; end if;

  -- Find the most recent prior round (group or knockout)
  select id into v_prev_round
    from public.rounds
    where display_order < v_current_order
    order by display_order desc
    limit 1;

  if v_prev_round is not null then
    insert into public.fantasy_team_snapshots
      (user_id, round_id, player1_id, player2_id, player3_id, transfers_used, transfer_penalty)
    select
      prev.user_id, p_round_id, prev.player1_id, prev.player2_id, prev.player3_id, 0, 0
    from public.fantasy_team_snapshots prev
    where prev.round_id = v_prev_round
      and not exists (
        select 1 from public.fantasy_team_snapshots s2
        where s2.user_id = prev.user_id and s2.round_id = p_round_id
      )
    on conflict (user_id, round_id) do nothing;
  end if;
end;
$$;
