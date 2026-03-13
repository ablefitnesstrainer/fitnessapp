# V1 Performance Thresholds

Target thresholds for staging and production smoke validation.

## Page load (desktop + mobile)
- Dashboard initial render: <= 2.5s (fast network), <= 4.0s (slow 4G)
- Workouts page interactive: <= 3.0s
- Nutrition page interactive: <= 3.0s

## API response targets
- Messaging poll request (`/api/messages`): p95 <= 700ms
- Workout set commit: p95 <= 800ms
- Nutrition food search: p95 <= 900ms
- Leaderboard page fetch: p95 <= 1.2s

## Media
- Progress photo upload (client): <= 5s for 4MB image on fast network
- Message attachment upload: <= 6s for 10MB file on fast network

## Guardrails in app
- Conversations fetch capped (`limit=150`) to keep payload bounded.
- Leaderboard API paginated with `limit` + `cursor`.
- Ops/admin timelines capped to bounded query size.

## Failing threshold action
1. Capture route + payload size + role/user context.
2. Add pagination/limits or indexes before release.
3. Re-run benchmark and document new p95.
