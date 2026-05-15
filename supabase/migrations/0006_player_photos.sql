-- Add photo_url to players
alter table public.players add column if not exists photo_url text;

-- Create public storage bucket
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

-- Storage policies (idempotent: drop-then-create)
drop policy if exists "player-photos public read" on storage.objects;
create policy "player-photos public read" on storage.objects
  for select using (bucket_id = 'player-photos');

drop policy if exists "player-photos authenticated upload" on storage.objects;
create policy "player-photos authenticated upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'player-photos');

drop policy if exists "player-photos authenticated update" on storage.objects;
create policy "player-photos authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'player-photos');

drop policy if exists "player-photos authenticated delete" on storage.objects;
create policy "player-photos authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'player-photos');
