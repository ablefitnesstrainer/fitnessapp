# Mobile Phase 1 (Separate Repo, Web Untouched)

## Summary
Build a new **Expo React Native app** in a **separate repository** for **Client + Coach** roles, launching **iOS first** and then Android.  
Phase 1 uses existing Supabase auth/data and existing backend APIs, with **web checkout handoff** for billing and a **light offline write queue**.  
No modifications to current web app behavior, routes, or UI.

## Key Implementation Changes
1. **Repo + architecture**
- Create `able-fitness-mobile` (separate repo) with Expo + TypeScript + Expo Router.
- Add shared environment config for Supabase URL/anon key and API base URL.
- Implement role-aware app shell: `client` and `coach` navigation trees only (no admin).

2. **Auth + session**
- Use Supabase native auth session handling in mobile.
- Support: login, magic-link completion, logout, session restore on app open.
- Add guarded route middleware in app layer by role and auth state.

3. **Phase 1 feature surface**
- Client screens: Dashboard (mobile summary), Workouts (today/session logging), Nutrition (daily targets + log meals), Check-ins (submit/view recent), Messages.
- Coach screens: Dashboard summary, Client roster/list, Client detail (recent activity), Messages.
- Reuse existing backend endpoints/RLS patterns; no schema or web-route rewrites.

4. **Billing behavior**
- In mobile, billing actions open existing web checkout/portal URLs in system browser/in-app browser.
- App reads subscription status from current backend status endpoint and gates paid-only surfaces consistently.

5. **Offline + sync**
- Implement local write queue for critical actions: workout set commits, message sends, check-in submits.
- Queue retries automatically on reconnect with idempotency keys and conflict-safe replay.
- Read paths remain online-first (no deep offline dataset cache in Phase 1).

6. **Observability + release**
- Add mobile crash/error reporting and API error telemetry.
- Release sequence: internal QA build -> TestFlight beta -> production iOS -> Android parity release.

## Public Interfaces / Contract Notes
- **No breaking changes** to existing web app interfaces.
- Mobile consumes existing APIs and Supabase tables under current RLS.
- Mobile introduces internal contracts only:
1. Typed API client for existing endpoints (messages, workouts, nutrition, check-ins, billing status).
2. Offline queue payload schema with idempotency token per mutation.
3. Role-based navigation contract (`client`, `coach`).

## Test Plan
1. **Auth/session**
- Login/logout/session restore across cold start and token refresh.
- Role guard blocks cross-role navigation.

2. **Core flows**
- Client: complete first workout session (start -> commit set -> complete), submit check-in, log meal, send message.
- Coach: view roster, open client detail, send/reply messages.

3. **Offline scenarios**
- Perform queued actions offline, reconnect, verify single successful replay and no duplicates.
- Retry behavior for transient API failures and server 4xx/5xx handling.

4. **Billing**
- Open checkout/portal handoff from app and return to app.
- Subscription status refresh correctly gates premium screens.

5. **Release quality**
- iOS device matrix smoke tests (latest + previous iOS major).
- Performance sanity: primary screens interactive within defined mobile thresholds under realistic data.

## Assumptions and Defaults
- AI features are explicitly out of scope for Phase 1.
- Push notifications are deferred to a later phase.
- Admin workflows are out of scope.
- Existing backend auth, RLS, and APIs are sufficient for Phase 1 with no web-app code changes.
- Android ships after iOS stabilization, with feature parity target.
