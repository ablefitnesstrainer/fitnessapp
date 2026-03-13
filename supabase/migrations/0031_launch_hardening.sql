create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  created_by uuid not null references public.app_users(id) on delete cascade,
  assigned_to uuid references public.app_users(id) on delete set null,
  subject text not null,
  category text not null check (category in ('login','billing','contracts','technical','other')),
  message text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  last_response_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_updates (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.app_users(id) on delete cascade,
  message text not null,
  status_to text check (status_to in ('open','in_progress','resolved','closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_client_status on public.support_tickets(client_id, status, created_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets(status, created_at desc);
create index if not exists idx_support_ticket_updates_ticket on public.support_ticket_updates(ticket_id, created_at asc);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_updates enable row level security;

drop policy if exists "support tickets read own coach admin" on public.support_tickets;
create policy "support tickets read own coach admin" on public.support_tickets
for select using (
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
);

drop policy if exists "support tickets insert own coach admin" on public.support_tickets;
create policy "support tickets insert own coach admin" on public.support_tickets
for insert with check (
  created_by = auth.uid() and (
    public.is_client_owner(client_id) or
    public.is_client_of_coach(client_id) or
    public.current_role() = 'admin'
  )
);

drop policy if exists "support tickets update own coach admin" on public.support_tickets;
create policy "support tickets update own coach admin" on public.support_tickets
for update using (
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
)
with check (
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
);

drop policy if exists "support tickets delete admin" on public.support_tickets;
create policy "support tickets delete admin" on public.support_tickets
for delete using (public.current_role() = 'admin');

drop policy if exists "support ticket updates read own coach admin" on public.support_ticket_updates;
create policy "support ticket updates read own coach admin" on public.support_ticket_updates
for select using (
  exists (
    select 1
    from public.support_tickets st
    where st.id = ticket_id and (
      public.is_client_owner(st.client_id) or
      public.is_client_of_coach(st.client_id) or
      public.current_role() = 'admin'
    )
  )
);

drop policy if exists "support ticket updates insert own coach admin" on public.support_ticket_updates;
create policy "support ticket updates insert own coach admin" on public.support_ticket_updates
for insert with check (
  author_id = auth.uid() and
  exists (
    select 1
    from public.support_tickets st
    where st.id = ticket_id and (
      public.is_client_owner(st.client_id) or
      public.is_client_of_coach(st.client_id) or
      public.current_role() = 'admin'
    )
  )
);

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid references public.app_users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  actor_user_id uuid not null references public.app_users(id) on delete cascade,
  document_type text not null check (document_type in ('privacy_policy','terms_of_service','liability_ack','challenge_participation','contract_disclosure')),
  document_version text not null,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_legal_acceptances_user_created on public.legal_acceptances(app_user_id, created_at desc);
create index if not exists idx_legal_acceptances_client_created on public.legal_acceptances(client_id, created_at desc);
create index if not exists idx_legal_acceptances_doc on public.legal_acceptances(document_type, document_version, created_at desc);

alter table public.legal_acceptances enable row level security;

drop policy if exists "legal acceptances read own coach admin" on public.legal_acceptances;
create policy "legal acceptances read own coach admin" on public.legal_acceptances
for select using (
  (app_user_id = auth.uid()) or
  (client_id is not null and public.is_client_of_coach(client_id)) or
  public.current_role() = 'admin'
);

drop policy if exists "legal acceptances insert actor coach admin" on public.legal_acceptances;
create policy "legal acceptances insert actor coach admin" on public.legal_acceptances
for insert with check (
  actor_user_id = auth.uid() and (
    (app_user_id = auth.uid()) or
    (client_id is not null and public.is_client_of_coach(client_id)) or
    public.current_role() = 'admin'
  )
);

create table if not exists public.ops_alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  channel text not null default 'email' check (channel in ('email')),
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  status text not null default 'sent' check (status in ('sent','suppressed','failed')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ops_alert_events_last_seen on public.ops_alert_events(last_seen_at desc);
create index if not exists idx_ops_alert_events_status on public.ops_alert_events(status, last_seen_at desc);

alter table public.ops_alert_events enable row level security;

drop policy if exists "ops alerts read admin" on public.ops_alert_events;
create policy "ops alerts read admin" on public.ops_alert_events
for select using (public.current_role() = 'admin');

drop policy if exists "ops alerts write admin" on public.ops_alert_events;
create policy "ops alerts write admin" on public.ops_alert_events
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.touch_updated_at();

drop trigger if exists trg_ops_alert_events_updated_at on public.ops_alert_events;
create trigger trg_ops_alert_events_updated_at
before update on public.ops_alert_events
for each row execute function public.touch_updated_at();

insert into public.security_settings (key, value)
values
  (
    'alerts:ops_runtime',
    jsonb_build_object(
      'enabled', true,
      'recipient_email', null,
      'from_email', null,
      'dedupe_window_minutes', 60,
      'quiet_hours_start', 22,
      'quiet_hours_end', 6
    )
  )
on conflict (key) do nothing;
