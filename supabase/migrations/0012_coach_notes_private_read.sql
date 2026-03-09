drop policy if exists "coach notes read own coach admin" on public.coach_notes;

create policy "coach notes read coach admin" on public.coach_notes
for select using (
  public.is_client_of_coach(client_id) or
  public.current_role() = 'admin'
);
