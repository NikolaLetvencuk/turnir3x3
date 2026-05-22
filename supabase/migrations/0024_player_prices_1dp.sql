-- Player prices must be stored at exactly 1-decimal precision so that
--    displayed prices (toFixed(1)) and summed totals never disagree.
-- The previous update_player_prices() used round(x, 2), producing values
-- like 9.85 / 10.35 that displayed as 9.8 / 10.3 but summed at 2dp.

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

  if v_next_round_id is null then v_next_round_id := p_round_id; end if;

  insert into public.player_prices (player_id, round_id, price)
  select
    p.id,
    v_next_round_id,
    greatest(4.0,
      round(
        (coalesce(prev.price, 10.0) + 0.05 * (coalesce(fpp.total_points, 0) - 2))::numeric,
        1
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

-- Normalise every existing price row to 1dp so sums stop drifting.
update public.player_prices
set price = round(price::numeric, 1);
