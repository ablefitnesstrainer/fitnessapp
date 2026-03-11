alter table if exists public.program_assignments
  add column if not exists start_on date not null default current_date;

update public.program_assignments
set start_on = coalesce(start_on, current_date)
where start_on is null;
