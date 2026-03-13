# Access Control Matrix (V1)

Roles:
- `admin`
- `coach`
- `client`

## Core pages
- `/dashboard`: all authenticated roles
- `/clients`: admin + coach
- `/clients/[clientId]`: admin + coach (assigned scope for coach)
- `/programs/templates`: admin + coach
- `/programs/generator`: admin + coach
- `/programs/editor`: admin + coach
- `/workouts`: all roles (role-specific data scope)
- `/nutrition`: all roles (role-specific data scope)
- `/messages`: all roles (peer visibility scoped by role)
- `/checkins`: all roles (role-specific data scope)

## Admin pages
- `/admin/users`: admin only
- `/admin/security`: admin only
- `/admin/security/settings`: admin only
- `/admin/security/operations`: admin only
- `/admin/club-automation`: admin only
- `/admin/billing`: admin only
- `/admin/ops-health`: admin only

## Coach/Admin moderation
- `/community/moderation`: admin + coach

## Sensitive APIs (minimum expected)
- `/api/admin/*`: admin only
- `/api/clients` (`PATCH`, `DELETE`): admin + coach (coach limited to assigned clients)
- `/api/contracts` (`POST`): admin + coach
- `/api/challenges/[id]/bulk-enroll`: admin + coach (coach limited to own challenge/templates/clients)
- `/api/challenges/[id]/join`: client only
- `/api/billing/webhook`: Stripe signature only (server-to-server)

## Data isolation requirements
- No cross-client PII in client role payloads.
- Client can only read/write own check-ins, nutrition, workout logs, habits, and support tickets.
- Coach can only operate on assigned clients.
- Admin can access global operational and audit views.

## Verification notes
- Enforced by combination of:
  - Supabase RLS policies
  - API role checks (`app_users.role`)
  - Middleware redirects and billing/mfa session gates
- Re-run `npm run test:security` after auth or route changes.
