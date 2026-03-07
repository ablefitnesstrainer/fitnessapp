-- Fix recursion in app_users RLS role checks.
-- current_role() must bypass RLS on app_users.

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_users where id = auth.uid();
$$;

revoke all on function public.current_role() from public;
grant execute on function public.current_role() to authenticated;
