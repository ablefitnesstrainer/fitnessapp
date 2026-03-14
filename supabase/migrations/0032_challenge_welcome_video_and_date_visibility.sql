alter table public.challenges
  add column if not exists welcome_video_url text,
  add column if not exists welcome_video_title text;

create index if not exists idx_challenges_dates_status on public.challenges(starts_on, ends_on, status);
