-- Generic key-value store for admin-toggleable site settings (popup ad, etc.)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
  values ('popup_ad_enabled', 'false'::jsonb)
  on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings public read" on public.app_settings;
create policy "app_settings public read" on public.app_settings for select using (true);
-- Writes happen via service-role admin client only; no anon write policy needed.
