# Low-cost operations: architecture review

Date: 2026-10-15
Status: APPROVED — code/tests/IaC only; no Production provisioning, env/secrets, migration or deployment.

## Goal and boundaries

Replace continuous database polling with business events and low-frequency cleanup.
Keep reservation, email, authentication, and newsletter correctness. Preserve existing
Production data, Payment Gate, customer sessions, secrets, and unrelated legal drafts.
All three existing AWS schedules remain DISABLED. No resource deletion is proposed.
No implementation, infrastructure provisioning, migration, commit, or push has occurred.

## Findings that change the implementation design

1. Paid inventory holds intentionally use `expiresAt = NULL`. A strict
   `ACTIVE AND expiresAt > now` predicate would remove valid paid holds.
2. Payment success currently checks reservation status, not elapsed expiry. Once
   cleanup is no longer frequent, an elapsed-but-ACTIVE reservation could otherwise
   be incorrectly confirmed. Expiry validation must also protect payment lifecycle.
3. Scheduled newsletters rely on the periodic worker to discover their future due
   time. Removing recovery polling without a replacement would strand campaigns.
4. Admin authentication is an eight-hour signed JWT, not a persisted AdminSession
   table. A server-verified sliding idle deadline is possible without a migration;
   account activity must not be stored in `AdminUser.lastLoginAt` as a substitute.
5. Initial post-commit email trigger failure currently relies on periodic recovery.
   Adding a timer only after provider failure does not cover a stranded PENDING row,
   a crashed SENDING worker, or a failed attempt to create the timer itself.
6. Existing staff notifications omit customer details and message summaries. Adding
   them is an explicit exception to the current notification-only privacy design;
   customer notification content and ownership boundaries must remain unchanged.

## Proposed reservation design

- Central effective-hold predicate:
  `status = ACTIVE AND (expiresAt IS NULL OR expiresAt > trustedServerNow)`.
- Expired cleanup predicate:
  `status = ACTIVE AND expiresAt IS NOT NULL AND expiresAt <= trustedServerNow`.
- Apply effective-hold semantics to inventory sums, checkout checks, public and
  admin projections, and payment confirmation validation under transaction locks.
- An elapsed hold cannot be revived by late payment success; retain the existing
  REQUIRES_REVIEW outcome. Preserve paid NULL-expiry holds and historical ownership.
- Release, consume, and cleanup transitions require individual lifecycle review;
  do not mechanically replace every ACTIVE status mutation with a stock predicate.
- Cleanup changes status only and must not change stock results a second time.
- Document daily cleanup at 03:00 Asia/Tokyo as the future operating recommendation.
  Do not enable or reschedule the existing AWS resource in this development phase.

## Email architecture options requiring approval

### Recommended: durable event queue plus one-time scheduling

- Keep the current Outbox as the business source of truth and existing Resend
  idempotency keys, webhook handling, consent gates, and template security.
- Use a durable queue/event delivery path for actual work, not periodic DB scans.
  A queued delivery carries identifiers only, never recipients, bodies, or tokens.
- Use one-time scheduling for the 30-minute retry and future newsletter dispatch
  where a queue delay cannot express the required time. Deterministic identifiers
  prevent duplicate schedules; completed one-time schedules are removed.
- Retry provider failures after 1, 5, and 30 minutes, then terminal FAILED after the
  final attempt. Successful sends do not create a provider retry task.
- Keep retry policy separate from event transport retries and worker crash recovery.
  Queue visibility, Outbox compare-and-set claims, bounded stale-lock recovery, and
  provider idempotency must be tested together. Do not promise unconditional
  exactly-once sending across an external provider and PostgreSQL.
- Initial event publication and retry-schedule creation can fail after a DB commit.
  Do not silently treat an unaccepted handoff as scheduled. Preserve the durable row,
  surface an actionable delivery failure, retry the handoff boundedly, and define a
  manual reconciliation path. Any stronger automatic recovery guarantee requires a
  separately designed durable handoff/CDC mechanism, not an in-memory timeout.
- Scheduled newsletters receive their own scheduled dispatch event. Cancellation,
  rescheduling, duplicates, and unsubscribing before delivery remain safe.
- Production readiness requires explicit authorization and verification of new queue,
  DLQ, one-time scheduler permissions, invocation targets, and non-secret configuration.
  The disabled legacy schedules must not be re-enabled as an implicit fallback.

### Alternative: one-time schedules targeting the existing Lambda

This uses fewer new resource types and supports all retry delays, but scheduling
alone is not a durable lease for a worker already processing an email. It still needs
an explicit answer for lost initial triggers, crashed SENDING rows, and AWS scheduling
failures. Do not deploy a retry-only timer and claim polling-free reliable delivery.

## Admin and notification design

- Replace interval polling with one initial fetch, focus/visibility refresh, explicit
  refresh, and existing local read/reply events. Coalesce simultaneous browser events.
  Hidden pages do not start requests; cancel background reads when hidden where possible.
- Track real user interaction locally. Fifteen minutes idle stops automatic refresh;
  resuming activity refreshes once. No activity heartbeat runs while unattended.
- Enforce a signed one-hour idle deadline server-side in the shared JWT verifier,
  proxy, page auth, API auth, and developer authorization. Renew only on explicit
  authenticated activity, with same-origin checks; background reads/prefetch do not
  renew. Keep the existing absolute session ceiling and HttpOnly cookie protections.
- Do not revive an expired token. Customer session behavior remains unchanged.
  No new AdminSession table is required for this signed-token design.
- Reuse CONTACT_RECIPIENT_EMAIL for staff notifications. Add bounded escaped customer
  name/email, subject/category where actually available, message summary, timestamp,
  and an authenticated Admin detail link. No fabricated category or customer fields.
  Do not add this information to customer notifications or operational logs.

## Documentation, verification, and release

- Update the four source-of-truth documents before implementation after approval.
  Change the Smaregi formal default to 24 hours; preserve existing manual Admin sync.
  Describe Reservation as daily cleanup and Email as event-driven, not 5m/10m polling.
- Preserve last-sync time and the storefront inventory freshness notice; do not
  represent daily mirrored inventory as guaranteed real-time in-store stock.
- Tests cover expiry boundary and NULL holds; paid/late-payment lifecycle; duplicate
  cleanup; initial dispatch loss, worker crash, scheduling failure, duplicate event,
  provider ambiguity, retry exhaustion; future newsletter dispatch and opt-out;
  staff notification privacy; hidden/idle/focus behavior; signed idle expiry across
  APIs/navigation/developer routes; unchanged customer auth and Checkout disabled gate.
- Run focused suites, full Playwright E2E, TypeScript, lint, build, Prisma validation,
  and diff checks. Use isolated test data, never Production email or mutation fixtures.
- Commit/push only after all required verification passes. Keep legal drafts out.
  No design-only commit is made before these tests, as requested.
- Until the event path is provisioned and accepted, report email production readiness
  as blocked; do not represent a code deploy alone as a working reliability upgrade.

## Approved execution boundary

The user approved the written design and implementation plan, with in-session execution.
Only business code, tests, local/test validation, infrastructure definitions and documents are authorized.
No Production AWS resource, IAM permission, env/secret or migration may be created or applied.
No deployment is authorized. If safe non-deploying push cannot be established, stop after local commit.
The minimal payment exception is specifically approved: elapsed ACTIVE holds use existing
REQUIRES_REVIEW without re-holding, changing API contracts, enabling Checkout or altering other states.
Real queue/Scheduler/Resend acceptance remains a separate authorized rollout task.
