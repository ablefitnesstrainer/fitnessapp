create table if not exists public.rate_limits (
  scope text not null,
  identifier text not null,
  window_started_at timestamptz not null default now(),
  hits integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (scope, identifier)
);

create index if not exists idx_rate_limits_updated_at on public.rate_limits(updated_at desc);

alter table public.rate_limits enable row level security;

create policy "rate limits read admin only" on public.rate_limits
for select using (public.current_role() = 'admin');

create table if not exists public.login_lockouts (
  email text primary key,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_login_lockouts_locked_until on public.login_lockouts(locked_until);
create index if not exists idx_login_lockouts_updated_at on public.login_lockouts(updated_at desc);

alter table public.login_lockouts enable row level security;

create policy "login lockouts read admin only" on public.login_lockouts
for select using (public.current_role() = 'admin');

create or replace function public.consume_rate_limit(
  p_scope text,
  p_identifier text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - make_interval(secs => p_window_seconds);
  v_hits integer;
  v_started timestamptz;
begin
  insert into public.rate_limits(scope, identifier, window_started_at, hits, updated_at)
  values (p_scope, p_identifier, v_now, 1, v_now)
  on conflict (scope, identifier) do update
    set hits = case
      when public.rate_limits.window_started_at < v_window_start then 1
      else public.rate_limits.hits + 1
    end,
    window_started_at = case
      when public.rate_limits.window_started_at < v_window_start then v_now
      else public.rate_limits.window_started_at
    end,
    updated_at = v_now
  returning public.rate_limits.hits, public.rate_limits.window_started_at into v_hits, v_started;

  if v_hits <= p_limit then
    return query select true, greatest(p_limit - v_hits, 0), 0;
    return;
  end if;

  return query
  select
    false,
    0,
    greatest(
      1,
      ceil(extract(epoch from ((v_started + make_interval(secs => p_window_seconds)) - v_now)))::integer
    );
end;
$$;
