create table if not exists public.security_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id) on delete set null
);

alter table public.security_settings enable row level security;

create policy "security settings read admin only" on public.security_settings
for select using (public.current_role() = 'admin');

create policy "security settings write admin only" on public.security_settings
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

insert into public.security_settings(key, value)
values
  ('rate_limit:auth.login.ip', '{"limit":50,"window_seconds":600}'::jsonb),
  ('rate_limit:auth.login.email', '{"limit":20,"window_seconds":600}'::jsonb),
  ('rate_limit:messages.send', '{"limit":120,"window_seconds":60}'::jsonb),
  ('rate_limit:messages.upload', '{"limit":20,"window_seconds":600}'::jsonb),
  ('rate_limit:admin.set_password', '{"limit":12,"window_seconds":600}'::jsonb),
  ('rate_limit:exercises.import_csv', '{"limit":8,"window_seconds":3600}'::jsonb),
  ('rate_limit:programs.generate', '{"limit":60,"window_seconds":3600}'::jsonb),
  ('lockout:login', '{"threshold":5,"base_seconds":60,"max_seconds":3600}'::jsonb)
on conflict (key) do nothing;
