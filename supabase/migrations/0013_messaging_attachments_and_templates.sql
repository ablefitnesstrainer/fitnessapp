alter table public.messages
  add column if not exists attachment_url text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size integer,
  add column if not exists attachment_path text;

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_templates_owner on public.message_templates(owner_id, created_at desc);

alter table public.message_templates enable row level security;

create policy "message templates read own" on public.message_templates
for select using (owner_id = auth.uid());

create policy "message templates write own coach admin" on public.message_templates
for all using (
  owner_id = auth.uid() and public.current_role() in ('coach', 'admin')
)
with check (
  owner_id = auth.uid() and public.current_role() in ('coach', 'admin')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  true,
  15728640,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
