# Low-cost operations implementation — 2026-10-15

## Production daily schedules — 2026-10-17

The approved daily schedules supersede the original disabled development state below.
Production Email Event cutover is complete: Production consumer Enabled, Preview consumer Disabled.

| Existing resource (not recreated) | Expression | Timezone | State |
| --- | --- | --- | --- |
| sake-shop-smaregi-sync-15m | cron(0 9 * * ? *) | Asia/Tokyo | ENABLED |
| sake-shop-reservation-expiration-5m | cron(0 3 * * ? *) | Asia/Tokyo | ENABLED |
| sake-shop-email-outbox-2m | rate(10 minutes) | UTC | DISABLED |

Flexible windows remain OFF. Existing targets, input, roles and retry settings are preserved.
Smaregi health uses the last successful sync: HEALTHY through 30h (including 26h), WARNING
after 30h and CRITICAL after 48h; a failed latest run remains CRITICAL immediately.
Admin manual sync is unchanged. Reservation cleanup only marks elapsed, non-NULL ACTIVE
holds EXPIRED; effective inventory and paid NULL-expiry holds are unchanged.
No job is invoked manually, no migration runs, and Checkout remains Disabled.

## Delivery boundary

Isolated worktree: /Users/shu/.codex/worktrees/low-cost-operations/sake-shop
Branch: codex/low-cost-operations; base: 195ec23f048e83c652f8b57847d3797cf40ec74b.
Local commit only. No push, Production/Preview deployment, Production migration, new AWS resource,
IAM grant, Production env/secret or Production business-data mutation.
Vercel project read returned 403; safe non-deploying push could not be established.
Main legal drafts and unrelated Office/test documents remain outside this change.

## Behavior

- Reservations: ACTIVE AND (NULL expiry OR expiry > trusted server now), shared by public/Admin
  occupancy and locked checkout aggregation. Elapsed ACTIVE rows stop occupying stock before cleanup.
  Cleanup updates only non-NULL expiry <= now to EXPIRED, idempotently, without changing mirror stock.
- Payment exception: check validity after sorted Product locks; invalid/elapsed holds go through existing
  REQUIRES_REVIEW. Never clear their expiry or re-hold. No Payment API, other payment-state semantics,
  Payment Gate or Checkout enablement change.
- Email: transactional Outbox first, identifier-only durable events after commit, provider idempotency
  preserved; failures retry after 1/5/30 minutes, then terminal FAILED after four total attempts.
  No recurring recovery polling. Stale leases are conditionally reclaimed; old lease completions cannot overwrite state.
- Future Newsletter: one-time scheduled event with exact scheduledAt validation, cancellation/reschedule
  guards, transactional recipient enqueue and bounded continuation events beyond 20 recipients.
  Neon consent is rechecked immediately before send.
- Crash recovery: terminal outbox replay repairs campaign aggregates without resending; aggregate failure
  leaves the event unacknowledged. Lost initial publication still requires visible manual reconciliation:
  PostgreSQL commit and AWS publication are not atomic.
- Inquiry: existing configured staff recipient and transactional Outbox, bounded name/email/subject/category,
  500-character summary, timestamp and authenticated Admin link. Customer notifications still omit body/notes.
  No staff recipient is invented; absence of CONTACT_RECIPIENT_EMAIL means no staff recipient configured locally.
- Admin: no 30-second interval; first visible load, focus, visibility, manual/local-read events. Hidden pages
  start no refresh, pending summary reads are aborted where possible; 15-minute idle pauses reads until activity.
  User interaction renews Admin auth at most once per minute, never as a periodic heartbeat.
  Shared signed-token verification rejects at 1h idle and retains original 8h absolute expiry.
  Legacy tokens require re-login. Customer auth/session isolation is unchanged.
- Smaregi: formal default 24h + existing manual sync; no automatic sync enabled. Product detail now shows
  the oldest available mirror timestamp and an in-store-sales inventory caveat; no real-time stock promise.

## Tests and acceptance

| Check | Final result |
| --- | --- |
| Orders / Customer / Admin / email / Newsletter | 246 passed, 0 failed |
| Products (including freshness UI render) | 166 passed, 0 failed |
| Smaregi / inventory | 76 passed, 0 failed |
| Full Playwright after final review fix | 20 passed, 2 existing skips, 0 failed |
| TypeScript / lint | PASS |
| Prisma validate | PASS; no migration |
| Production build | PASS, 87 static pages generated |
| CloudFormation local cfn-lint 1.40.4 | PASS |
| git diff --check | PASS |

Initial new browser-test assertion counted development StrictMode's initial mount/abort/remount as polling.
Changed only its post-hydration baseline; zero extra reads over virtual 90s/15min and one resume/manual
refresh remain asserted. No retry, skip or timeout relaxation was added.
Independent read-only review found and verified the campaign terminal-completion gap; three RED tests
(SENT/SKIPPED/FAILED) passed after the fix. Reviewer did not create resources or run real email tests.
Existing test-database image URLs produced CloudFront 403 and Next development warnings; these are
recorded, not represented as new Production failures or repaired in this task.

## Original development schedules (2026-10-15 snapshot)

| Existing name | State |
| --- | --- |
| sake-shop-reservation-expiration-5m | DISABLED |
| sake-shop-email-outbox-2m | DISABLED |
| sake-shop-smaregi-sync-15m | DISABLED |

Do not restore frequency from historical resource names. Future launch recommendation: Smaregi once/24h;
optional reservation cleanup daily 03:00 Asia/Tokyo; legacy Email recovery stays disabled.
No migration, schedule enablement, expression update, task invocation or resource deletion was performed.

## Before launch: resources still NOT created

See infrastructure/aws/email-events/template.yaml and README.md.
Proposed prefix: sake-shop-production (dev/testing uses separate sake-shop-dev prefix).
Create only after separate approval:
event queue, DLQ, dedicated one-time Scheduler group, worker Lambda, disabled-by-default event source
mapping, 14-day log group, Scheduler role, worker role and unattached application policy.
One-time schedule instances are created by approved runtime events, never by periodic scanning.

Minimum runtime IAM:
- Application: sqs:SendMessage on exact event queue; scheduler:CreateSchedule/DeleteSchedule only
  dedicated group's email-* schedules; iam:PassRole only exact Scheduler role, conditioned on Scheduler service.
- Scheduler role: sqs:SendMessage only event queue and DLQ; trust restricted to Scheduler, account, exact group.
- Worker: sqs:ReceiveMessage/DeleteMessage/GetQueueAttributes only event queue; ssm:GetParameter only
  existing parameter ARN; logs:CreateLogStream/PutLogEvents only own log group. If needed, separately
  approve kms:Decrypt only existing customer-managed key and SSM context.

Future non-secret application configuration, NOT set in Production:
EMAIL_EVENT_QUEUE_URL, EMAIL_EVENT_QUEUE_ARN, EMAIL_EVENT_DLQ_ARN,
EMAIL_EVENT_SCHEDULE_GROUP, EMAIL_EVENT_SCHEDULE_ROLE_ARN.
Use existing approved AWS identity/region and existing CRON/SSM secret. No new secret is defined.
Worker configuration: existing endpoint and existing parameter name. Runtime IAM and actual
queue/Scheduler timing, DLQ, Resend acceptance require authorized non-production acceptance before launch.

## Neon idle expectation

No fixed-interval database work remains in application business code while schedules are disabled.
Unattended Admin tabs have no polling or activity heartbeat. With no visitors, crawler traffic,
email/webhook events or external database-health probes, Neon can become idle.
This is theoretical behavior, not a measured scale-to-zero or cost claim. No Neon plan or external monitor changed.

## Deferred minor review findings

- Synthetic activity can reset UI refresh-idle tracking; signed authentication renewal separately requires
  trusted browser events. No current timer or request path dispatches such activity.
- Lost-lease CAS completions may inflate returned worker success counters; durable database state stays protected.

## Technical rulings and review boundaries

- Ruling: defer all commits until full acceptance — user's explicit gate overrides per-task commit guidance.
- Ruling: payment success uses same sorted Product row locks as checkout, sampling trusted time after locks — prevents re-hold/checkout race without new payment state/API — cost if wrong: lock contention, covered by existing transaction bounds.
- Ruling: package manager tried updating latest dependencies while adding AWS clients; restored all original existing resolutions and retained only required SDK additions — prevents unrelated framework changes.
- Ruling: new browser test initial count measured after hydration because Next dev StrictMode mounts/aborts/remounts effects — interval absence still asserts zero additional requests over 90s/15min; focused browser test passes. Initial full E2E 19 passed / 2 existing skips / 1 new-test failure. No retries/timeout/skip added.
- Ruling: Vercel get-project read denied (403); no alternate credential route attempted. Cannot establish safe push, so retain local commit only, no push/deploy — cost: manual publication step remains.
- Final: Ruling: real AWS/IAM/Scheduler/Resend acceptance deferred to separately authorized rollout — no provisioning or real sends permitted — cost: mock/IaC validation is not Production acceptance.
- Final: Ruling: independently verify schedules and main drafts in parent rather than reviewer — reviewer remains isolated/read-only — cost: evidence comes from separate parent checks.
- Final: Ruling: final E2E/build are parent acceptance gates, not claimed by reviewer — run complete tests before commit — cost: commit remains blocked until all pass.
- Final: Ruling: unconditional exactly-once and automatic recovery of lost initial handoffs are not promised — durable rows plus visible manual reconciliation as approved — cost: failed initial publication can delay mail pending operator action.
- Final: Ruling: only new event-path completion repaired; unrelated historical batch-worker redesign excluded — same terminal outbox replay now repairs its own campaign boundary — cost: legacy direct calls retain historical operational semantics.

## Changed files (54)

- README.md
- app/api/v1/admin/auth/activity/route.ts
- app/api/v1/internal/email/process/route.ts
- components/admin/activity.tsx
- components/admin/inquiry-detail.tsx
- components/admin/inquiry-notifications.tsx
- components/admin/workspace.tsx
- components/product-detail.tsx
- config/email.ts
- config/operations.ts
- config/smaregi.ts
- docs/01_REQUIREMENTS.md
- docs/02_SYSTEM_ARCHITECTURE.md
- docs/03_DATABASE.md
- docs/04_API_SPEC.md
- docs/LOW_COST_OPERATIONS_IMPLEMENTATION.md
- docs/superpowers/plans/2026-10-15-low-cost-operations.md
- docs/superpowers/specs/2026-10-15-low-cost-operations-architecture-review.md
- e2e/account/admin-event-refresh.spec.ts
- infrastructure/aws/email-events/README.md
- infrastructure/aws/email-events/index.mjs
- infrastructure/aws/email-events/template.yaml
- infrastructure/aws/email-outbox-trigger/README.md
- infrastructure/aws/reservation-expiration-trigger/README.md
- lib/admin-activity.ts
- lib/admin-inquiry-polling.ts
- lib/admin-session.ts
- package.json
- pnpm-lock.yaml
- repositories/contact-inquiry.repository.ts
- repositories/effective-reservation.ts
- repositories/email-outbox.repository.ts
- repositories/inventory-reservation.repository.ts
- repositories/newsletter-campaign.repository.ts
- repositories/operations-health.repository.ts
- repositories/payment.repository.ts
- services/email-dispatch-trigger.service.ts
- services/email-event-adapters/aws-email-event.adapter.ts
- services/email-event-transport.service.ts
- services/email-event.service.ts
- services/email-outbox.service.ts
- services/email-template.service.ts
- services/newsletter-campaign.service.ts
- services/operations-health.service.ts
- tests/orders/admin-idle-session.test.ts
- tests/orders/admin-inquiry-polling.test.ts
- tests/orders/effective-reservations.test.ts
- tests/orders/email-event-adapter.test.ts
- tests/orders/email-events.test.ts
- tests/orders/email-infrastructure.test.ts
- tests/orders/newsletter-campaign.test.ts
- tests/orders/operations-health.test.ts
- tests/orders/staff-notification.test.ts
- tests/products/inventory-freshness.test.ts
