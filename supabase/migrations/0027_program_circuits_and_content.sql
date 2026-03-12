alter table public.program_exercises
  add column if not exists block_type text not null default 'standard' check (block_type in ('standard', 'circuit')),
  add column if not exists circuit_label text,
  add column if not exists circuit_rounds integer;

update public.program_exercises
set
  block_type = coalesce(block_type, 'standard'),
  circuit_rounds = case when block_type = 'circuit' then coalesce(circuit_rounds, 3) else null end
where block_type is null
   or (block_type = 'circuit' and circuit_rounds is null);

insert into public.security_settings(key, value)
values
  ('content:client_welcome_video_url', '{"value":""}'::jsonb),
  ('content:client_welcome_video_title', '{"value":"Welcome to Able Fitness"}'::jsonb)
on conflict (key) do nothing;
