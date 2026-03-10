update storage.buckets
set public = false
where id in ('progress-photos', 'message-attachments');

alter table public.progress_photos
  alter column photo_url drop not null;
