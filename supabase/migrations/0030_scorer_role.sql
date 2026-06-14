-- New role: 'scorer' — a buyer/operator who only logs match results.
-- They see ONLY the Matches admin tab (start/finish/events), nothing else.
-- Role is still changeable only by the service role (see 0003).

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin', 'scorer'));
