create table if not exists public.quick_meal_templates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  calories integer not null,
  protein integer not null,
  carbs integer not null,
  fat integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_quick_meal_templates_client_id_created_at
  on public.quick_meal_templates(client_id, created_at desc);

alter table public.quick_meal_templates enable row level security;

drop policy if exists "quick meal templates policy" on public.quick_meal_templates;
create policy "quick meal templates policy" on public.quick_meal_templates
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
