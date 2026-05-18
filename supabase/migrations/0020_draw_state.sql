-- Singleton state for the live group draw. Admin schedules; all clients watch in sync.
create table if not exists public.draw_state (
  id boolean primary key default true check (id = true),
  state text not null default 'idle' check (state in ('idle','scheduled','running','committed')),
  scheduled_at timestamptz,
  per_pick_ms int not null default 5000,
  result jsonb,
  created_by uuid,
  updated_at timestamptz default now()
);

insert into public.draw_state (id) values (true) on conflict (id) do nothing;

alter table public.draw_state enable row level security;

drop policy if exists "draw_state public read" on public.draw_state;
create policy "draw_state public read" on public.draw_state for select using (true);

-- Add to realtime publication so all subscribed clients see updates.
do $$
begin
  begin
    alter publication supabase_realtime add table public.draw_state;
  exception when duplicate_object then
    null;
  end;
end$$;
