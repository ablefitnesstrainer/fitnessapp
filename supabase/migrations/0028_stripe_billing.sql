alter table if exists public.app_users
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists subscription_price_id text,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists billing_updated_at timestamptz not null default now();

create unique index if not exists ux_app_users_stripe_customer_id
  on public.app_users (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists ux_app_users_stripe_subscription_id
  on public.app_users (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_app_users_subscription_status
  on public.app_users (subscription_status);
