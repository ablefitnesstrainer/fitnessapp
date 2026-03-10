create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.app_users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor_created on public.audit_logs(actor_id, created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists idx_audit_logs_action_created on public.audit_logs(action, created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit logs insert self" on public.audit_logs
for insert with check (actor_id = auth.uid() or public.current_role() = 'admin');

create policy "audit logs read admin only" on public.audit_logs
for select using (public.current_role() = 'admin');
