create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  created_by uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.challenge_enrollments (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  enrolled_by uuid not null references public.app_users(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(challenge_id, client_id)
);

create table if not exists public.challenge_program_assignments (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  template_id uuid not null references public.program_templates(id) on delete cascade,
  start_on date not null,
  assignment_note text,
  created_by uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(challenge_id)
);

create table if not exists public.challenge_leaderboard_configs (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  ranking_slot integer not null check (ranking_slot between 1 and 3),
  label text not null,
  workouts_weight numeric not null default 1 check (workouts_weight >= 0),
  checkins_weight numeric not null default 1 check (checkins_weight >= 0),
  nutrition_weight numeric not null default 1 check (nutrition_weight >= 0),
  habits_weight numeric not null default 1 check (habits_weight >= 0),
  tie_breaker text not null default 'workouts_then_checkins',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(challenge_id, ranking_slot)
);

create table if not exists public.challenge_leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  ranking_slot integer not null check (ranking_slot between 1 and 3),
  score numeric not null default 0,
  previous_score numeric,
  workouts_component numeric not null default 0,
  checkins_component numeric not null default 0,
  nutrition_component numeric not null default 0,
  habits_component numeric not null default 0,
  rank_position integer,
  updated_at timestamptz not null default now(),
  unique(challenge_id, client_id, ranking_slot)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references public.app_users(id) on delete cascade,
  author_client_id uuid references public.clients(id) on delete set null,
  body text not null,
  is_hidden boolean not null default false,
  hidden_reason text,
  hidden_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  parent_comment_id uuid references public.community_comments(id) on delete cascade,
  author_user_id uuid not null references public.app_users(id) on delete cascade,
  author_client_id uuid references public.clients(id) on delete set null,
  body text not null,
  is_hidden boolean not null default false,
  hidden_reason text,
  hidden_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.app_users(id) on delete cascade,
  reporter_client_id uuid references public.clients(id) on delete set null,
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  reason text not null,
  resolved boolean not null default false,
  resolved_by uuid references public.app_users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint community_reports_target_check check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  )
);

create index if not exists idx_challenges_status_dates on public.challenges(status, starts_on, ends_on);
create index if not exists idx_challenge_enrollments_challenge on public.challenge_enrollments(challenge_id);
create index if not exists idx_challenge_enrollments_client on public.challenge_enrollments(client_id);
create index if not exists idx_challenge_scores_lookup on public.challenge_leaderboard_scores(challenge_id, ranking_slot, score desc);
create index if not exists idx_community_posts_created on public.community_posts(created_at desc);
create index if not exists idx_community_comments_post_created on public.community_comments(post_id, created_at asc);
create index if not exists idx_community_reports_resolved on public.community_reports(resolved, created_at desc);

drop trigger if exists trg_challenges_updated_at on public.challenges;
create trigger trg_challenges_updated_at
before update on public.challenges
for each row execute function public.touch_updated_at();

drop trigger if exists trg_challenge_program_assignments_updated_at on public.challenge_program_assignments;
create trigger trg_challenge_program_assignments_updated_at
before update on public.challenge_program_assignments
for each row execute function public.touch_updated_at();

drop trigger if exists trg_challenge_leaderboard_configs_updated_at on public.challenge_leaderboard_configs;
create trigger trg_challenge_leaderboard_configs_updated_at
before update on public.challenge_leaderboard_configs
for each row execute function public.touch_updated_at();

drop trigger if exists trg_community_posts_updated_at on public.community_posts;
create trigger trg_community_posts_updated_at
before update on public.community_posts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_community_comments_updated_at on public.community_comments;
create trigger trg_community_comments_updated_at
before update on public.community_comments
for each row execute function public.touch_updated_at();

alter table public.challenges enable row level security;
alter table public.challenge_enrollments enable row level security;
alter table public.challenge_program_assignments enable row level security;
alter table public.challenge_leaderboard_configs enable row level security;
alter table public.challenge_leaderboard_scores enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reports enable row level security;

drop policy if exists "challenges read all authed" on public.challenges;
create policy "challenges read all authed" on public.challenges
for select using (auth.uid() is not null);

drop policy if exists "challenges write coach admin" on public.challenges;
create policy "challenges write coach admin" on public.challenges
for all using (public.current_role() in ('coach', 'admin'))
with check (public.current_role() in ('coach', 'admin'));

drop policy if exists "challenge enrollments read all authed" on public.challenge_enrollments;
create policy "challenge enrollments read all authed" on public.challenge_enrollments
for select using (auth.uid() is not null);

drop policy if exists "challenge enrollments write coach admin" on public.challenge_enrollments;
create policy "challenge enrollments write coach admin" on public.challenge_enrollments
for all using (public.current_role() in ('coach', 'admin'))
with check (public.current_role() in ('coach', 'admin'));

drop policy if exists "challenge program assignments read all authed" on public.challenge_program_assignments;
create policy "challenge program assignments read all authed" on public.challenge_program_assignments
for select using (auth.uid() is not null);

drop policy if exists "challenge program assignments write coach admin" on public.challenge_program_assignments;
create policy "challenge program assignments write coach admin" on public.challenge_program_assignments
for all using (public.current_role() in ('coach', 'admin'))
with check (public.current_role() in ('coach', 'admin'));

drop policy if exists "challenge leaderboard configs read all authed" on public.challenge_leaderboard_configs;
create policy "challenge leaderboard configs read all authed" on public.challenge_leaderboard_configs
for select using (auth.uid() is not null);

drop policy if exists "challenge leaderboard configs write coach admin" on public.challenge_leaderboard_configs;
create policy "challenge leaderboard configs write coach admin" on public.challenge_leaderboard_configs
for all using (public.current_role() in ('coach', 'admin'))
with check (public.current_role() in ('coach', 'admin'));

drop policy if exists "challenge leaderboard scores read all authed" on public.challenge_leaderboard_scores;
create policy "challenge leaderboard scores read all authed" on public.challenge_leaderboard_scores
for select using (auth.uid() is not null);

drop policy if exists "challenge leaderboard scores write coach admin" on public.challenge_leaderboard_scores;
create policy "challenge leaderboard scores write coach admin" on public.challenge_leaderboard_scores
for all using (public.current_role() in ('coach', 'admin'))
with check (public.current_role() in ('coach', 'admin'));

drop policy if exists "community posts read all authed" on public.community_posts;
create policy "community posts read all authed" on public.community_posts
for select using (
  (auth.uid() is not null and is_hidden = false)
  or public.current_role() in ('coach', 'admin')
);

drop policy if exists "community posts create authed" on public.community_posts;
create policy "community posts create authed" on public.community_posts
for insert with check (auth.uid() is not null and author_user_id = auth.uid());

drop policy if exists "community posts update own or coach admin" on public.community_posts;
create policy "community posts update own or coach admin" on public.community_posts
for update using (author_user_id = auth.uid() or public.current_role() in ('coach', 'admin'))
with check (author_user_id = auth.uid() or public.current_role() in ('coach', 'admin'));

drop policy if exists "community posts delete own or coach admin" on public.community_posts;
create policy "community posts delete own or coach admin" on public.community_posts
for delete using (author_user_id = auth.uid() or public.current_role() in ('coach', 'admin'));

drop policy if exists "community comments read all authed" on public.community_comments;
create policy "community comments read all authed" on public.community_comments
for select using (
  (auth.uid() is not null and is_hidden = false)
  or public.current_role() in ('coach', 'admin')
);

drop policy if exists "community comments create authed" on public.community_comments;
create policy "community comments create authed" on public.community_comments
for insert with check (auth.uid() is not null and author_user_id = auth.uid());

drop policy if exists "community comments update own or coach admin" on public.community_comments;
create policy "community comments update own or coach admin" on public.community_comments
for update using (author_user_id = auth.uid() or public.current_role() in ('coach', 'admin'))
with check (author_user_id = auth.uid() or public.current_role() in ('coach', 'admin'));

drop policy if exists "community comments delete own or coach admin" on public.community_comments;
create policy "community comments delete own or coach admin" on public.community_comments
for delete using (author_user_id = auth.uid() or public.current_role() in ('coach', 'admin'));

drop policy if exists "community reports read coach admin only" on public.community_reports;
create policy "community reports read coach admin only" on public.community_reports
for select using (public.current_role() in ('coach', 'admin'));

drop policy if exists "community reports create authed" on public.community_reports;
create policy "community reports create authed" on public.community_reports
for insert with check (auth.uid() is not null and reporter_user_id = auth.uid());

drop policy if exists "community reports resolve coach admin" on public.community_reports;
create policy "community reports resolve coach admin" on public.community_reports
for update using (public.current_role() in ('coach', 'admin'))
with check (public.current_role() in ('coach', 'admin'));

insert into public.security_settings(key, value)
values
  ('rate_limit:challenges.bulk_enroll', '{"limit":20,"window_seconds":3600}'::jsonb),
  ('rate_limit:community.posts.create', '{"limit":30,"window_seconds":3600}'::jsonb),
  ('rate_limit:community.comments.create', '{"limit":120,"window_seconds":3600}'::jsonb),
  ('rate_limit:community.reports.create', '{"limit":40,"window_seconds":3600}'::jsonb)
on conflict (key) do nothing;
