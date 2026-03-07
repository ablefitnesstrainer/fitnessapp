alter table public.app_users
  add column if not exists full_name text;

update public.app_users
set full_name = trim(initcap(replace(replace(split_part(email, '@', 1), '.', ' '), '_', ' ')))
where (full_name is null or trim(full_name) = '') and email is not null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    'client'
  )
  on conflict (id) do nothing;

  insert into public.clients (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
