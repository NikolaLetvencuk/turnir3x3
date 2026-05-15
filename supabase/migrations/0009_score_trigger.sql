-- Score is derived from match_events; refresh trigger keeps cache in matches table
create or replace function public.refresh_match_score(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home uuid;
  v_away uuid;
  v_h int;
  v_a int;
begin
  select home_team_id, away_team_id into v_home, v_away from public.matches where id = p_match_id;
  if v_home is null then return; end if;

  select count(*) into v_h
    from public.match_events
    where match_id = p_match_id
      and ((event_type = 'goal' and team_id = v_home) or (event_type = 'own_goal' and team_id = v_away));

  select count(*) into v_a
    from public.match_events
    where match_id = p_match_id
      and ((event_type = 'goal' and team_id = v_away) or (event_type = 'own_goal' and team_id = v_home));

  update public.matches
    set home_score = coalesce(v_h, 0),
        away_score = coalesce(v_a, 0)
    where id = p_match_id;
end;
$$;

create or replace function public.trg_match_events_refresh_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match uuid;
begin
  if tg_op = 'DELETE' then v_match := old.match_id; else v_match := new.match_id; end if;
  perform public.refresh_match_score(v_match);
  return null;
end;
$$;

drop trigger if exists match_events_refresh_score on public.match_events;
create trigger match_events_refresh_score
after insert or update or delete on public.match_events
for each row execute function public.trg_match_events_refresh_score();
