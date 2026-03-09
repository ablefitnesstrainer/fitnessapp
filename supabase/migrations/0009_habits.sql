create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  target_value numeric not null default 1,
  unit text not null default 'times',
  is_active boolean not null default true,
  created_by uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  log_date date not null,
  value numeric not null default 0,
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique(habit_id, log_date)
);

create index if not exists idx_habits_client_id on public.habits(client_id);
create index if not exists idx_habit_logs_client_date on public.habit_logs(client_id, log_date desc);

alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;

create policy "habits read own coach admin" on public.habits
for select using (
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
);

create policy "habits write own coach admin" on public.habits
for all using (
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
)
with check (
  (public.is_client_owner(client_id) or
   public.is_client_of_coach(client_id) or
   public.current_role() = 'admin')
  and created_by = auth.uid()
);

create policy "habit logs read own coach admin" on public.habit_logs
for select using (
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
);

create policy "habit logs write own coach admin" on public.habit_logs
for all using (
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
)
with check (
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
);
