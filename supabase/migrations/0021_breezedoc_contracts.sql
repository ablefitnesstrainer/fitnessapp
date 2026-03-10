create table if not exists public.client_contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  provider text not null default 'breezedoc',
  template_id integer,
  document_id integer not null,
  document_slug text,
  status text not null default 'sent',
  client_name text,
  client_email text,
  coach_name text,
  coach_email text,
  client_party integer,
  coach_party integer,
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_contracts_client_created on public.client_contracts(client_id, created_at desc);
create index if not exists idx_client_contracts_status on public.client_contracts(status);

alter table public.client_contracts enable row level security;

create policy "client contracts read own coach admin" on public.client_contracts
for select using (
  public.current_role() = 'admin' or
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id)
);

create policy "client contracts write coach admin" on public.client_contracts
for all using (
  public.current_role() = 'admin' or
  public.is_client_of_coach(client_id)
)
with check (
  public.current_role() = 'admin' or
  public.is_client_of_coach(client_id)
);

insert into public.security_settings(key, value)
values ('rate_limit:contracts.send', '{"limit":10,"window_seconds":3600}'::jsonb)
on conflict (key) do nothing;
