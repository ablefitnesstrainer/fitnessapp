create table if not exists public.message_typing_status (
  sender_id uuid not null references public.app_users(id) on delete cascade,
  receiver_id uuid not null references public.app_users(id) on delete cascade,
  typed_at timestamptz not null default now(),
  primary key (sender_id, receiver_id)
);

create index if not exists idx_message_typing_receiver on public.message_typing_status(receiver_id, typed_at desc);

alter table public.message_typing_status enable row level security;

create policy "message typing read participants" on public.message_typing_status
for select using (
  sender_id = auth.uid() or
  receiver_id = auth.uid() or
  public.current_role() = 'admin'
);

create policy "message typing write sender admin" on public.message_typing_status
for all using (
  sender_id = auth.uid() or
  public.current_role() = 'admin'
)
with check (
  sender_id = auth.uid() or
  public.current_role() = 'admin'
);
