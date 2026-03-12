# Backup and Restore Verification Checklist

Use this checklist each quarter to prove backups are restorable.

## Pre-check
1. Confirm production is stable.
2. Pick a non-production Supabase project for restore testing.
3. Capture current production row counts for critical tables.

Critical tables:
- `app_users`
- `clients`
- `program_templates`
- `program_assignments`
- `workout_logs`
- `workout_sets`
- `meal_logs`
- `checkins`
- `messages`

## Restore dry-run
1. Restore latest backup snapshot into non-production.
2. Verify schema migrations are present.
3. Compare row counts against production baseline.
4. Spot-check linked data integrity:
- `clients.user_id -> app_users.id`
- `program_days.week_id -> program_weeks.id`
- `workout_sets.log_id -> workout_logs.id`

## Workflow validation in restored environment
1. Login as coach/admin.
2. Open dashboard, clients, workouts, nutrition, check-ins, messages.
3. Send a test message and confirm receipt.
4. Open a workout log and verify historical sets are readable.
5. Validate contract status data still resolves.

## Evidence to record
- Date/time of dry-run
- Actor
- Snapshot used
- Pass/fail per workflow
- Any corrective actions

## Pass criteria
- No missing critical tables
- Row counts within expected range
- Core coach and client workflows function end-to-end
