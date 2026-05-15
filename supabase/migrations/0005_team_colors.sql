alter table public.teams
  add column if not exists primary_color text not null default '#1f2937',
  add column if not exists secondary_color text not null default '#f3f4f6';
