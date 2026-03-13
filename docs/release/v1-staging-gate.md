# V1 Staging Gate Checklist

Run this list in staging before any production smoke test.

## 1) Auth + role gate
- [ ] Admin can access all admin pages and APIs.
- [ ] Coach cannot access admin-only routes.
- [ ] Client cannot access coach/admin management surfaces.
- [ ] `npm run test:security` passes.

## 2) Billing lifecycle
- [ ] `checkout.session.completed` provisions user/client once (idempotent replay).
- [ ] `customer.subscription.updated` updates status (`active`, `trialing`, `past_due`, `unpaid`).
- [ ] `customer.subscription.deleted` sets canceled state.
- [ ] Billing portal opens and returns to app.

## 3) Monitoring + alerts
- [ ] Forced Stripe webhook failure creates ops alert/event.
- [ ] Forced welcome/provisioning failure creates warning event.
- [ ] Security anomaly alert flow still works and does not block request path.

## 4) Backup/restore
- [ ] Restore dry-run completed in non-production.
- [ ] Core entities validate after restore (`app_users`, `clients`, `program_assignments`, `messages`, `checkins`).
- [ ] RTO/RPO captured in ops notes.

## 5) Support flow
- [ ] Client can submit support ticket.
- [ ] Coach/admin can triage and update status.
- [ ] Ticket updates are audited.

## 6) Legal/consent audit
- [ ] Intake consent writes versioned legal acceptance record.
- [ ] Challenge join writes legal acceptance record.
- [ ] Contract send writes auditable legal event record.

## 7) Onboarding E2E
- [ ] New paid user: purchase -> welcome email -> auth -> intake -> first workout/check-in.
- [ ] Existing user repurchase does not create duplicate user/client records.
- [ ] Admin retry actions work (`Retry Email`, `Re-run Assignment`).

## 8) Performance sanity
- [ ] Messaging uses bounded queries.
- [ ] Leaderboards/community/timeline remain paginated/bounded.
- [ ] Mobile dashboard + workouts + nutrition remain responsive with realistic test data.
