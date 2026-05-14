-- Allow service_role / postgres to change profiles.role
create or replace function public.profiles_prevent_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'role column may only be changed by service role';
  end if;
  return new;
end;
$$;
