-- Track leftover bank per snapshot.
-- Bank = (budget at lock time) − (team cost). Carries over to the next round's budget.
alter table public.fantasy_team_snapshots
  add column if not exists bank numeric(5,2) not null default 0;

-- Updated lock_round: when falling back (user didn't lock for the new round),
-- copy bank from their previous snapshot too.
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

  select id into v_prev_round
    from public.rounds
    where display_order < v_current_order
    order by display_order desc
    limit 1;

  if v_prev_round is not null then
    insert into public.fantasy_team_snapshots
      (user_id, round_id, player1_id, player2_id, player3_id, transfers_used, transfer_penalty, bank)
    select
      prev.user_id, p_round_id, prev.player1_id, prev.player2_id, prev.player3_id, 0, 0,
      coalesce(prev.bank, 0)
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
