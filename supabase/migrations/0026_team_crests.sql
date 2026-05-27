-- Storage bucket for uploaded team crests. teams.logo_url already exists
-- (from 0001_init) but had no UI; this migration only wires the bucket and
-- its admin-write policies so the new upload flow has somewhere to put the
-- file. UI falls back to the initials-on-color crest when logo_url is null.

insert into storage.buckets (id, name, public)
values ('team-crests', 'team-crests', true)
on conflict (id) do update set public = excluded.public;

-- Read = public. Write/update/delete = admins only (matches existing
-- player-photos policy pattern from 0001_init).
drop policy if exists "team-crests public read" on storage.objects;
create policy "team-crests public read" on storage.objects
  for select to public
  using (bucket_id = 'team-crests');

drop policy if exists "team-crests admin write" on storage.objects;
create policy "team-crests admin write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'team-crests'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "team-crests admin update" on storage.objects;
create policy "team-crests admin update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'team-crests'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "team-crests admin delete" on storage.objects;
create policy "team-crests admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'team-crests'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
