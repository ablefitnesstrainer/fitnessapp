# Able Fitness Coaching App

Production-ready MVP for a coaching platform using Next.js, Supabase, PostgreSQL, Tailwind, and Vercel.

## Implemented

- Authentication (login/register with secure default client provisioning)
- Supabase schema + Row Level Security policies
- Exercise library with filtering + CSV import
- Program template builder
- Program generator with progression + deload week logic
- Client workout logging (warmup sets, rest timer, temporary/permanent swaps)
- Nutrition tracking (macro targets + meal logging)
- Messaging (coach/client/admin)
- Weekly check-ins
- Dashboard analytics (Chart.js)

## Stack

- Next.js 14 App Router
- React 18
- Tailwind CSS
- Supabase Auth + Postgres + RLS
- Chart.js / react-chartjs-2

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env.local
```

Fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (optional, only for admin password script)

3. Apply DB migration to Supabase:

- Run SQL in [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
- Then run SQL in [`supabase/migrations/0002_auth_hardening.sql`](./supabase/migrations/0002_auth_hardening.sql)
- Then run SQL in [`supabase/migrations/0003_fix_current_role_rls.sql`](./supabase/migrations/0003_fix_current_role_rls.sql)

Role note:
- Public signup always creates `client` users.
- Promote trusted users to `coach` or `admin` from Supabase SQL/editor only.

4. Run app:

```bash
npm run dev
```

## Key Paths

- Supabase schema + RLS: `supabase/migrations/0001_init.sql`
- Auth pages: `app/(auth)/login`, `app/(auth)/register`
- Main app routes: `app/(app)/*`
- APIs: `app/api/*`
- Supabase clients: `lib/supabase-*.ts`

## Password Management

- Forgot password page: `/forgot-password`
- Reset password page: `/reset-password`
- Logged-in password change: `/settings/password`
- Auth callback handler for email links: `/auth/callback`
- Admin set password page: `/admin/users` (admin role only)

Admin manual reset from terminal:

```bash
node scripts/set-user-password.mjs user@example.com NewSecurePass123!
```

Test reset flow without sending email (free plan friendly):

```bash
node scripts/generate-recovery-link.mjs user@example.com
```

Copy the printed link into browser and complete reset on `/reset-password`.

## Deployment

Deploy to Vercel and set the same environment variables in project settings.
# fitnessapp
