insert into public.security_settings(key, value)
values
  ('key_rotation:last_completed_on', '{"date": null}'::jsonb),
  ('key_rotation:next_due_on', jsonb_build_object('date', (current_date + interval '90 day')::date::text)),
  ('backup_restore:last_test_on', '{"date": null}'::jsonb),
  ('backup_restore:next_test_on', jsonb_build_object('date', (current_date + interval '90 day')::date::text))
on conflict (key) do nothing;
