# CI Triage Runbook

Use this runbook when GitHub Actions security workflows fail.

## Workflows
- `security-ci.yml`
- `nightly-security-audit.yml`
- `dependency-review.yml`

## Triage order
1. Open the failed run in GitHub Actions and note first failing step.
2. Classify failure:
   - **Code quality gate** (`typecheck`, `build`, `test:security`)
   - **Dependency audit** (`npm audit`)
   - **Platform/transient** (network/registry timeout, GitHub outage)
3. Reproduce locally from repo root:
   - `npm ci`
   - `npm run typecheck`
   - `npm run build`
   - `npm run test:security`
4. If reproducible, fix code/config and push a PR.
5. If transient only, re-run failed jobs and document the rerun reason in PR.

## Expected owners
- Security/runtime checks: engineering owner
- Dependency vulnerabilities: engineering owner + package owner
- Infrastructure/transient: engineering owner

## Escalation
- **High/Critical vulnerabilities**: fix same day and block release.
- **Build/type/security gate failures** on release branch: block release until green.
- **Repeated transient failures** (>3 in 24h): open infra ticket and temporarily disable noisy notification route.

## Noise control policy
- `security-ci` runs on PR + weekly schedule + manual dispatch.
- Nightly audit opens/fails only for actionable high/critical vulnerability counts.
