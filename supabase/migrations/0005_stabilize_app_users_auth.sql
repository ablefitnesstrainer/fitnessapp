-- Stabilize app user access and avoid RLS recursion issues during login.

insert into public.app_users (id, email, role)
select u.id, u.email, 'client'::public.app_role
from auth.users u
left join public.app_users au on au.id = u.id
where au.id is null
on conflict (id) do nothing;

insert into public.clients (user_id)
select u.id
from auth.users u
left join public.clients c on c.user_id = u.id
where c.user_id is null
on conflict (user_id) do nothing;

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

drop policy if exists "app_users read self or admin" on public.app_users;
drop policy if exists "app_users read authenticated" on public.app_users;
create policy "app_users read authenticated" on public.app_users
for select to authenticated using (true);
