-- Expand weekly check-in capture and add mandatory client intake records.

alter table public.checkins
  add column if not exists overall_week_rating integer,
  add column if not exists biggest_win text,
  add column if not exists biggest_challenge text,
  add column if not exists average_body_weight numeric,
  add column if not exists progress_photos_uploaded text,
  add column if not exists cycle_status text,
  add column if not exists nutrition_adherence_percent integer,
  add column if not exists protein_goal_hit boolean,
  add column if not exists hydration_goal_hit boolean,
  add column if not exists digestion_notes text,
  add column if not exists workouts_scheduled integer,
  add column if not exists training_performance text,
  add column if not exists recovery_status text,
  add column if not exists confidence_next_week integer,
  add column if not exists support_needed text;

create table if not exists public.client_intakes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  primary_goal text not null,
  training_experience text,
  injuries_or_limitations text,
  equipment_access text,
  days_per_week integer,
  session_length_minutes integer,
  nutrition_preferences text,
  dietary_restrictions text,
  stress_level integer,
  sleep_hours numeric,
  readiness_to_change integer,
  support_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_client_intakes_updated_at on public.client_intakes;
create trigger trg_client_intakes_updated_at
before update on public.client_intakes
for each row execute function public.touch_updated_at();

alter table public.client_intakes enable row level security;

drop policy if exists "client intakes policy" on public.client_intakes;
create policy "client intakes policy" on public.client_intakes
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
