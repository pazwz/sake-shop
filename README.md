# LINXAS FUKUOKA

## Development manual operations mode — 2026-10-15

No Production infrastructure, environment, secret, migration or deployment is authorized by this change.
The existing AWS schedules remain **DISABLED**:

| Existing resource name (historical cadence in name) | Current state | Intended launch operation |
| --- | --- | --- |
| sake-shop-reservation-expiration-5m | DISABLED | Optional daily cleanup at 03:00 Asia/Tokyo |
| sake-shop-email-outbox-2m | DISABLED | Remains disabled; event-driven replacement |
| sake-shop-smaregi-sync-15m | DISABLED | Once every 24h plus existing Admin manual sync |

Do not restore the old frequencies from these names. A separate launch approval is required.
Smaregi remains read-only. Stock displays must retain last-sync information and the warning that
in-store sales may change actual stock. Daily synchronization is not real-time inventory.

## Manual operations

- Smaregi: existing Admin integrations screen, manual immediate sync.
- Reservation cleanup: existing authenticated POST /api/v1/internal/reservations/expire, or existing
  reservation trigger Lambda manually after authorization. Do not invoke it merely to check configuration.
- Email: POST {} to the existing authenticated internal email/process endpoint republishes due IDs
  once the new event infrastructure is configured. Specific ID body remains supported.
  Until then the new event path is NOT Production-ready. Keep business Outbox rows for reconciliation.

Use the existing secret through approved runtime tooling; never paste it into commands or logs.
Manual operations can mutate business state and need an appropriate test target or approval.

## Correctness without recurring jobs

Effective reservations are ACTIVE AND (expiresAt IS NULL OR expiresAt > server now).
Elapsed non-NULL holds are excluded immediately, even if cleanup has not run.
Cleanup only marks such rows EXPIRED. NULL expiry preserves confirmed paid holds.
Late payment checks the same predicate and uses existing REQUIRES_REVIEW; it never restores stock.

Emails persist in Outbox, then publish identifier-only events. Provider retries follow 1/5/30 minutes
and stop after four total attempts. Future Newsletter campaigns use one-time events and bounded
continuation events. Neon consent remains the final send gate. See the infrastructure runbook
for failure/reconciliation limitations rather than assuming an exactly-once guarantee.

Admin has no 30-second polling. It refreshes on first visible load, focus, visibility restoration,
manual request and local read events; after 15 minutes idle only user activity resumes refresh.
Only explicit interaction renews the signed Admin session (throttled to once per minute).
Server checks enforce 1h idle and the existing 8h absolute expiry. Legacy tokens require re-login.
No Customer session behavior changes. Hidden pages do not start background refresh/renewal.

## Future resources and validation

See infrastructure/aws/email-events/README.md and template.yaml for resource names, configuration,
minimum IAM, disabled-by-default event source and rollout checks. Definitions do not create resources.
Before launch: authorize isolated infrastructure acceptance, provision/configure, verify delivery,
coordinate deployment, then separately authorize Smaregi daily and optional reservation daily cleanup.
Never re-enable recurring email polling.

Required validation: pnpm test:orders, pnpm test:products, pnpm test:smaregi, pnpm test:e2e,
pnpm exec tsc --noEmit, pnpm lint, pnpm exec prisma validate, pnpm build, git diff --check.
E2E must use the isolated database guard, never default Production credentials.

## Expected Neon wakeups

With the three existing schedules disabled and no visitors, browser actions or external monitors,
application business code has no fixed-interval database job. Admin unattended tabs have no
30-second reads or activity heartbeat; focus/resume/manual actions are event-driven.
After separately approved launch, defaults are one Smaregi sync/day and optional cleanup/day.
Email wakes the database only for enqueue, actual delivery/retry, webhook or manual reconciliation.
Public page/API requests, crawler traffic, database-health probes and external uptime monitors can
still wake Neon. No monitor or Neon plan is changed here; actual scale-to-zero must be checked later.
This is a behavioral expectation, not a measured compute-cost or suspend-time guarantee.
