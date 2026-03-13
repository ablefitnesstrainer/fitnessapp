create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  status text not null default 'processed' check (status in ('processed','skipped','failed')),
  error_message text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_member_events (
  id uuid primary key default gen_random_uuid(),
  stripe_customer_id text,
  stripe_subscription_id text,
  app_user_id uuid references public.app_users(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  challenge_id uuid references public.challenges(id) on delete set null,
  template_id uuid references public.program_templates(id) on delete set null,
  event_type text not null,
  status text not null default 'processed' check (status in ('processed','warning','failed','pending')),
  notes text,
  payload jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0,
  last_error text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_webhook_events_processed_at on public.billing_webhook_events(processed_at desc);
create index if not exists idx_billing_webhook_events_type on public.billing_webhook_events(event_type, processed_at desc);
create index if not exists idx_club_member_events_created on public.club_member_events(created_at desc);
create index if not exists idx_club_member_events_status on public.club_member_events(status, created_at desc);
create index if not exists idx_club_member_events_user on public.club_member_events(app_user_id, created_at desc);

alter table public.billing_webhook_events enable row level security;
alter table public.club_member_events enable row level security;

drop policy if exists "billing webhook events read admin" on public.billing_webhook_events;
create policy "billing webhook events read admin" on public.billing_webhook_events
for select using (public.current_role() = 'admin');

drop policy if exists "billing webhook events write admin" on public.billing_webhook_events;
create policy "billing webhook events write admin" on public.billing_webhook_events
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "club member events read admin" on public.club_member_events;
create policy "club member events read admin" on public.club_member_events
for select using (public.current_role() = 'admin');

drop policy if exists "club member events write admin" on public.club_member_events;
create policy "club member events write admin" on public.club_member_events
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop trigger if exists trg_billing_webhook_events_updated_at on public.billing_webhook_events;
create trigger trg_billing_webhook_events_updated_at
before update on public.billing_webhook_events
for each row execute function public.touch_updated_at();

drop trigger if exists trg_club_member_events_updated_at on public.club_member_events;
create trigger trg_club_member_events_updated_at
before update on public.club_member_events
for each row execute function public.touch_updated_at();

insert into public.security_settings(key, value)
values
  ('club:automation', jsonb_build_object(
    'enabled', true,
    'fallback_mode', 'next_upcoming',
    'welcome_email_enabled', true,
    'welcome_from_email', null,
    'welcome_support_email', null
  )),
  ('rate_limit:funnel.club_checkout', '{"limit":30,"window_seconds":3600}'::jsonb)
on conflict (key) do nothing;
