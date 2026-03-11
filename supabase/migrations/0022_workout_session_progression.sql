alter table if exists public.program_assignments
  add column if not exists current_week_number integer,
  add column if not exists current_day_number integer,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.workout_sets
  add column if not exists program_exercise_id uuid references public.program_exercises(id) on delete set null;

update public.program_assignments
set
  current_week_number = coalesce(current_week_number, start_week, 1),
  current_day_number = coalesce(current_day_number, 1),
  updated_at = now()
where current_week_number is null or current_day_number is null;

create unique index if not exists ux_workout_sets_log_program_exercise_warmup_set
  on public.workout_sets (log_id, program_exercise_id, is_warmup, set_number)
  where program_exercise_id is not null;
