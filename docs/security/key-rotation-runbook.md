# Key Rotation and Backup Verification Runbook

## Scope
This runbook covers quarterly rotation and validation for:
- Supabase service role key
- USDA FDC API key
- BreezeDoc API token
- Backup/restore verification checks

## Rotation Cadence
- Frequency: every 90 days (quarterly)
- Dry-run window: same quarterly cycle
- Owner: Admin role

## Quarterly reminder setup
1. Create a recurring calendar event every 90 days named `Able Fitness - Security Rotation`.
2. Attach:
- `docs/security/key-rotation-runbook.md`
- `docs/security/backup-restore-checklist.md`
- `docs/security/monitoring-and-alerts.md`
3. Add two reminders:
- 7 days before
- same day at start of maintenance window

## Preparation Checklist
1. Confirm current production is stable.
2. Export current environment variable names from Vercel.
3. Open Supabase project settings and service keys.
4. Open USDA and BreezeDoc portals.
5. Notify any team member of a short maintenance validation window.

## Supabase Service Role Key Rotation
1. Generate/regenerate service role key in Supabase.
2. Update Vercel environment variable:
- `SUPABASE_SERVICE_ROLE_KEY`
3. Keep old key only as rollback fallback during validation window.
4. Deploy latest production build.
5. Validate server-side operations:
- password reset endpoint
- contract send endpoint
- file signed URL generation
6. Revoke old key when validation passes.

## USDA Key Rotation
1. Generate new USDA API key.
2. Update Vercel variable:
- `USDA_FDC_API_KEY`
3. Validate nutrition search + food autofill in production.
4. Revoke old key in USDA portal.

## BreezeDoc Token Rotation
1. Generate new personal access token in BreezeDoc.
2. Update Vercel variable:
- `BREEZEDOC_API_TOKEN`
3. Validate contract send and webhook status updates.
4. Revoke old token after successful validation.

## Backup and Restore Verification
1. Confirm Supabase backup status in dashboard.
2. Perform restore dry-run in non-production project using:
- `docs/security/backup-restore-checklist.md`
3. Record verification date and notes in Security Operations page.

## Rollback Plan
If any key rotation validation fails:
1. Revert impacted variable to previous value.
2. Redeploy.
3. Confirm health check endpoints and core workflows.
4. Re-open rotation task after root cause is fixed.

## Evidence to Capture
- Date/time of rotation
- Actor/admin who executed
- Test results for each integration
- Restore dry-run result and environment used
