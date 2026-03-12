# Security Monitoring and Alerts

## Objective
Detect authentication abuse, authorization issues, and suspicious activity early.

## Recommended alert streams
1. Auth failures spike
- Trigger when login failures exceed baseline in a 15-minute window.
- Signal source: app audit logs (`auth.login_failed`, `auth.login_locked`).

2. 401/403 API spike
- Trigger when unauthorized/forbidden API responses exceed baseline.
- Signal source: Vercel logs, API route metrics.

3. Rate-limit events spike
- Trigger when rate-limit responses (429) increase rapidly.
- Signal source: API responses + audit logs.

4. Sensitive action anomalies
- Track unusual volumes for:
- password resets
- client deletions
- bulk challenge enrollments
- security settings updates

## Minimum dashboards
1. Daily auth success vs failure trend
2. Top endpoints by 401/403/429
3. Sensitive admin actions by actor and time
4. Contract webhook signature failures

## Alert severity and response
1. P1 (Immediate)
- Sustained auth abuse, webhook signature failures, or repeated forbidden admin attempts.
- Action: rotate affected keys if compromise suspected, block IP ranges, review audit trail.

2. P2 (Same day)
- Elevated 401/403/429 rates without clear abuse source.
- Action: inspect deployment changes and recent feature releases.

3. P3 (Planned)
- Minor trend changes.
- Action: review during weekly security check.

## Operational cadence
- Weekly: review security dashboard trends.
- Monthly: review alert thresholds and reduce noise.
- Quarterly: run key rotation + backup restore checklist.
