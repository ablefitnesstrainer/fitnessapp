-- Able Fitness Coaching App - Supabase schema + RLS

create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'coach', 'client');

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role public.app_role not null,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.app_users(id) on delete cascade,
  coach_id uuid references public.app_users(id) on delete set null,
  age integer,
  height integer,
  goal text,
  equipment text,
  created_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_muscle text,
  secondary_muscle text,
  equipment text,
  difficulty text,
  video_url text,
  instructions text,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.program_templates (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  goal_type text,
  days_per_week integer,
  experience_level text,
  equipment_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.program_templates(id) on delete cascade,
  week_number integer not null,
  created_at timestamptz not null default now(),
  unique(template_id, week_number)
);

create table if not exists public.program_days (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.program_weeks(id) on delete cascade,
  day_number integer not null,
  created_at timestamptz not null default now(),
  unique(week_id, day_number)
);

create table if not exists public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sets integer not null,
  reps integer not null,
  warmup_sets jsonb default '[]'::jsonb,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.program_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  template_id uuid not null references public.program_templates(id) on delete cascade,
  start_week integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(client_id, template_id)
);

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  day_id uuid references public.program_days(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_minutes integer,
  total_volume numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.workout_logs(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number integer not null,
  reps integer not null,
  weight numeric not null default 0,
  is_warmup boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  calories integer not null,
  protein integer not null,
  carbs integer not null,
  fat integer not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  food_name text not null,
  calories integer not null,
  protein integer not null,
  carbs integer not null,
  fat integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bodyweight_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  weight numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  workouts_completed integer not null,
  energy integer not null,
  hunger integer not null,
  sleep integer not null,
  stress integer not null,
  adherence integer not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.app_users(id) on delete cascade,
  receiver_id uuid not null references public.app_users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clients_coach_id on public.clients(coach_id);
create index if not exists idx_exercises_primary_muscle on public.exercises(primary_muscle);
create index if not exists idx_program_assignments_client_id on public.program_assignments(client_id);
create index if not exists idx_workout_logs_client_id on public.workout_logs(client_id);
create index if not exists idx_meal_logs_client_id_created_at on public.meal_logs(client_id, created_at desc);
create index if not exists idx_messages_sender_receiver_created_at on public.messages(sender_id, receiver_id, created_at desc);

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_users where id = auth.uid();
$$;

create or replace function public.is_client_owner(client_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.clients c
    where c.id = client_uuid and c.user_id = auth.uid()
  );
$$;

create or replace function public.is_client_of_coach(client_uuid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.clients c
    where c.id = client_uuid and c.coach_id = auth.uid()
  );
$$;

alter table public.app_users enable row level security;
alter table public.clients enable row level security;
alter table public.exercises enable row level security;
alter table public.program_templates enable row level security;
alter table public.program_weeks enable row level security;
alter table public.program_days enable row level security;
alter table public.program_exercises enable row level security;
alter table public.program_assignments enable row level security;
alter table public.workout_logs enable row level security;
alter table public.workout_sets enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.meal_logs enable row level security;
alter table public.bodyweight_logs enable row level security;
alter table public.checkins enable row level security;
alter table public.messages enable row level security;

create policy "app_users read authenticated" on public.app_users
for select to authenticated using (true);

create policy "app_users insert self" on public.app_users
for insert with check (id = auth.uid());

create policy "app_users update admin" on public.app_users
for update using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "clients read own coach admin" on public.clients
for select using (
  user_id = auth.uid() or
  coach_id = auth.uid() or
  public.current_role() = 'admin'
);

create policy "clients upsert coach admin" on public.clients
for all using (coach_id = auth.uid() or user_id = auth.uid() or public.current_role() = 'admin')
with check (coach_id = auth.uid() or user_id = auth.uid() or public.current_role() = 'admin');

create policy "exercises read all authed" on public.exercises
for select to authenticated using (true);

create policy "exercises write coach admin" on public.exercises
for all using (public.current_role() in ('coach', 'admin'))
with check (public.current_role() in ('coach', 'admin'));

create policy "program templates access" on public.program_templates
for all using (
  coach_id = auth.uid() or
  public.current_role() = 'admin' or
  exists (
    select 1 from public.program_assignments a
    join public.clients c on c.id = a.client_id
    where a.template_id = program_templates.id and c.user_id = auth.uid()
  )
)
with check (coach_id = auth.uid() or public.current_role() = 'admin');

create policy "program weeks read" on public.program_weeks
for select using (
  exists (
    select 1 from public.program_templates t
    where t.id = program_weeks.template_id and (
      t.coach_id = auth.uid() or
      public.current_role() = 'admin' or
      exists (
        select 1 from public.program_assignments a
        join public.clients c on c.id = a.client_id
        where a.template_id = t.id and c.user_id = auth.uid()
      )
    )
  )
);

create policy "program weeks write" on public.program_weeks
for all using (
  exists (
    select 1 from public.program_templates t
    where t.id = program_weeks.template_id and (t.coach_id = auth.uid() or public.current_role() = 'admin')
  )
)
with check (
  exists (
    select 1 from public.program_templates t
    where t.id = program_weeks.template_id and (t.coach_id = auth.uid() or public.current_role() = 'admin')
  )
);

create policy "program days policy" on public.program_days
for all using (
  exists (
    select 1 from public.program_weeks w
    join public.program_templates t on t.id = w.template_id
    where w.id = program_days.week_id and (
      t.coach_id = auth.uid() or
      public.current_role() = 'admin' or
      exists (
        select 1 from public.program_assignments a
        join public.clients c on c.id = a.client_id
        where a.template_id = t.id and c.user_id = auth.uid()
      )
    )
  )
)
with check (
  exists (
    select 1 from public.program_weeks w
    join public.program_templates t on t.id = w.template_id
    where w.id = program_days.week_id and (t.coach_id = auth.uid() or public.current_role() = 'admin')
  )
);

create policy "program exercises policy" on public.program_exercises
for all using (
  exists (
    select 1 from public.program_days d
    join public.program_weeks w on w.id = d.week_id
    join public.program_templates t on t.id = w.template_id
    where d.id = program_exercises.day_id and (
      t.coach_id = auth.uid() or
      public.current_role() = 'admin' or
      exists (
        select 1 from public.program_assignments a
        join public.clients c on c.id = a.client_id
        where a.template_id = t.id and c.user_id = auth.uid()
      )
    )
  )
)
with check (
  exists (
    select 1 from public.program_days d
    join public.program_weeks w on w.id = d.week_id
    join public.program_templates t on t.id = w.template_id
    where d.id = program_exercises.day_id and (t.coach_id = auth.uid() or public.current_role() = 'admin')
  )
);

create policy "program assignments policy" on public.program_assignments
for all using (
  public.current_role() = 'admin' or
  exists (
    select 1 from public.clients c where c.id = client_id and c.coach_id = auth.uid()
  ) or
  exists (
    select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid()
  )
)
with check (
  public.current_role() = 'admin' or
  exists (
    select 1 from public.clients c where c.id = client_id and c.coach_id = auth.uid()
  )
);

create policy "workout logs policy" on public.workout_logs
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

create policy "workout sets policy" on public.workout_sets
for all using (
  exists (
    select 1 from public.workout_logs wl
    where wl.id = workout_sets.log_id and (
      public.is_client_owner(wl.client_id) or public.is_client_of_coach(wl.client_id) or public.current_role() = 'admin'
    )
  )
)
with check (
  exists (
    select 1 from public.workout_logs wl
    where wl.id = workout_sets.log_id and (
      public.is_client_owner(wl.client_id) or public.is_client_of_coach(wl.client_id) or public.current_role() = 'admin'
    )
  )
);

create policy "nutrition targets policy" on public.nutrition_targets
for all using (
  public.is_client_owner(client_id) or public.is_client_of_coach(client_id) or public.current_role() = 'admin'
)
with check (
  public.is_client_owner(client_id) or public.is_client_of_coach(client_id) or public.current_role() = 'admin'
);

create policy "meal logs policy" on public.meal_logs
for all using (
  public.is_client_owner(client_id) or public.is_client_of_coach(client_id) or public.current_role() = 'admin'
)
with check (
  public.is_client_owner(client_id) or public.is_client_of_coach(client_id) or public.current_role() = 'admin'
);

create policy "bodyweight logs policy" on public.bodyweight_logs
for all using (
  public.is_client_owner(client_id) or public.is_client_of_coach(client_id) or public.current_role() = 'admin'
)
with check (
  public.is_client_owner(client_id) or public.is_client_of_coach(client_id) or public.current_role() = 'admin'
);

create policy "checkins policy" on public.checkins
for all using (
  public.is_client_owner(client_id) or public.is_client_of_coach(client_id) or public.current_role() = 'admin'
)
with check (
  public.is_client_owner(client_id) or public.is_client_of_coach(client_id) or public.current_role() = 'admin'
);

create policy "messages policy" on public.messages
for all using (
  sender_id = auth.uid() or receiver_id = auth.uid() or public.current_role() = 'admin'
)
with check (sender_id = auth.uid() or public.current_role() = 'admin');
