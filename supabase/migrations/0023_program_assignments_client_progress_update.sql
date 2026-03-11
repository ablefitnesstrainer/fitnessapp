create policy "program assignments client progress update" on public.program_assignments
for update using (
  exists (
    select 1 from public.clients c
    where c.id = client_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.clients c
    where c.id = client_id and c.user_id = auth.uid()
  )
);
