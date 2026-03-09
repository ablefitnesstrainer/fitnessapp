alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists idx_messages_receiver_unread
  on public.messages(receiver_id, read_at, created_at desc);

create policy "messages receiver can mark read" on public.messages
for update
using (receiver_id = auth.uid() or public.current_role() = 'admin')
with check (true);
