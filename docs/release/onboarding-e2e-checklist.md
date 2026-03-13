# Onboarding E2E Checklist

Use staging first, then one controlled production smoke run.

## New paid user
1. Start checkout from funnel endpoint.
2. Complete payment.
3. Confirm Stripe webhook marks provisioning processed.
4. Confirm user/client records exist and challenge/program enrollment applied.
5. Confirm welcome email delivered.
6. Open magic link and confirm authenticated redirect to app.
7. Complete intake.
8. Log first workout set + complete workout.
9. Submit first weekly check-in.

## Existing user repurchase
1. Complete second purchase with same email.
2. Confirm no duplicate `app_users` row.
3. Confirm no duplicate `clients` row.
4. Confirm billing fields updated and automation event is idempotent.

## Failure recovery
1. Force welcome email failure (bad sender domain in staging).
2. Confirm event status = warning/failed in Club Automation page.
3. Run `Retry Email`.
4. Force assignment failure and verify `Re-run Assignment` fixes state.
