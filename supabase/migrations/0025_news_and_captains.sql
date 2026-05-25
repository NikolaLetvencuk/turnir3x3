-- News (admin posts, public reads). Realtime so homepages see new posts immediately.
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists news_created_at_idx on public.news(created_at desc);

alter table public.news enable row level security;

drop policy if exists "news public read" on public.news;
create policy "news public read" on public.news for select using (true);
-- Writes go through the admin client (service-role bypass), so no anon write policy.

do $$
begin
  begin
    alter publication supabase_realtime add table public.news;
  exception when duplicate_object then
    null;
  end;
end$$;

-- Team captains — phone + name, kept in a separate table because phone numbers
-- shouldn't be in the publicly readable teams payload.
create table if not exists public.team_captains (
  team_id uuid primary key references public.teams(id) on delete cascade,
  name text,
  phone text,
  updated_at timestamptz not null default now()
);

alter table public.team_captains enable row level security;

drop policy if exists "team_captains admin read" on public.team_captains;
-- Only admins (their profile row says so) can SELECT captain phones.
create policy "team_captains admin read" on public.team_captains
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
-- Writes again go through the admin/service-role client.
