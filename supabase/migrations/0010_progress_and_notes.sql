create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  photo_url text not null,
  caption text,
  taken_at date not null default current_date,
  uploaded_by uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  note text not null,
  created_by uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_progress_photos_client_id on public.progress_photos(client_id, taken_at desc);
create index if not exists idx_coach_notes_client_id on public.coach_notes(client_id, created_at desc);

alter table public.progress_photos enable row level security;
alter table public.coach_notes enable row level security;

create policy "progress photos read own coach admin" on public.progress_photos
for select using (
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
);

create policy "progress photos write coach admin" on public.progress_photos
for all using (
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
)
with check (
  (public.is_client_of_coach(client_id) or public.current_role() = 'admin')
  and uploaded_by = auth.uid()
);

create policy "coach notes read own coach admin" on public.coach_notes
for select using (
  public.is_client_owner(client_id) or
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
);

create policy "coach notes write coach admin" on public.coach_notes
for all using (
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
)
with check (
  (public.is_client_of_coach(client_id) or public.current_role() = 'admin')
  and created_by = auth.uid()
);
