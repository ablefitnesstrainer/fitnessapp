alter table public.client_intakes
  add column if not exists sex_at_birth text;

update public.client_intakes
set sex_at_birth = coalesce(nullif(sex_at_birth, ''), 'male')
where sex_at_birth is null or sex_at_birth = '';

alter table public.client_intakes
  drop constraint if exists client_intakes_sex_at_birth_check;

alter table public.client_intakes
  add constraint client_intakes_sex_at_birth_check
  check (sex_at_birth in ('male', 'female'));
