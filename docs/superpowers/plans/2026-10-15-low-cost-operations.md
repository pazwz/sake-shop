# Low-cost operations implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task after plan approval.

**Goal:** Reduce idle database wakeups without weakening inventory, email delivery, or authentication correctness.

**Architecture:** Keep PostgreSQL Outbox as business state; add identifier-only durable event transport and one-time scheduling adapters. Replace periodic Admin reads with interaction-driven refresh and a server-verified idle deadline. Inventory correctness is independent of cleanup.

**Tech Stack:** Next.js, TypeScript, Prisma/PostgreSQL, signed JWT, AWS SQS/Scheduler, infrastructure definitions and mocked AWS tests.

**Spec:** `docs/superpowers/specs/2026-10-15-low-cost-operations-architecture-review.md`; approved with the 2026-10-15 restriction: definitions and local/test validation only, no Production provisioning or deployment.

## Global constraints

- Do not create Production queues, DLQs, schedules, IAM permissions, secrets or environment variables. Do not deploy.
- Keep all three existing schedules DISABLED. Do not execute data-mutating Production jobs during verification.
- Preserve legal drafts and unrelated files; use an isolated worktree for implementation.
- No migration planned. Stop and explain necessity if implementation requires one.
- Do not alter Payment Gate, Checkout enablement, Customer session semantics, existing provider idempotency or unsubscribe protections.
- Commit and push only after the complete requested test suite passes; no intermediate commits that bypass this gate.
- Before code edits, reread the four source-of-truth documents and relevant installed Next.js documentation.

## Review focus

- A paid ACTIVE hold with NULL expiry must remain reserved; equality at expiry is invalid.
- Late payment cannot revive an elapsed reservation; existing review workflow must remain intact.
- A queue publish or schedule-creation failure is not accepted delivery; retain durable state and expose reconciliation requirements.
- Future campaigns and campaigns larger than one batch must not be stranded by removing polling.
- Hidden tabs, expired sessions and duplicate focus/activity events must not create background wake loops or revive authentication.

## Task 1: Reservation correctness, independently of cleanup

**Files:** `repositories/inventory-reservation.repository.ts`, `repositories/payment.repository.ts`, affected inventory consumers found by ACTIVE-query audit; `tests/orders/reservation-lifecycle.test.ts`, `tests/smaregi/inventory-reservation.test.ts`, `tests/smaregi/inventory-projection.test.ts`.

**Interface:** Centralize an effective-reservation predicate accepting trusted `Date`: ACTIVE AND (NULL expiry OR expiry > now). Cleanup uses non-NULL expiry <= now.

- [ ] Add failing tests for NULL paid holds, future/elapsed/equality expiry, aggregation and available-stock correctness before cleanup, idempotent cleanup, and late payment review.
- [ ] Run affected tests and confirm failures exercise old semantics.
- [ ] Audit every reservation count/sum and checkout validation query; apply the predicate only to effective occupancy, not blindly to lifecycle transitions or historical references.
- [ ] Preserve transaction locking and paid-hold conversion; reject elapsed ACTIVE reservations during payment confirmation through the existing review path.
- [ ] Rerun reservation/inventory/payment tests and document every audited query.

## Task 2: Durable email transport and infrastructure definitions

**Files:** create `services/email-event-transport.service.ts`, `services/email-event-adapters/aws-email-event.adapter.ts`, `infrastructure/aws/email-events/template.yaml`, `infrastructure/aws/email-events/README.md`, `tests/orders/email-event-transport.test.ts`; modify `config/email.ts` and dependency manifests only as required by AWS adapters.

**Interfaces:** Identifier-only discriminated events: `{kind:'outbox',outboxId:string}` or `{kind:'campaign',campaignId:string,scheduledAt:string}`. Transport exposes publish-now, schedule-once, and cancel-scheduled operations; injected clients permit deterministic tests without AWS access.

- [ ] Write failing transport tests for queue publication, deterministic schedule identity, cancellation, duplicate delivery, sanitized errors and failed handoff.
- [ ] Define SQS queue/DLQ, worker invocation, a dedicated one-time Scheduler group and narrowly scoped roles in IaC; resources must remain undeployed.
- [ ] Specify deployment-scoped names, identifier-only payload validation, visibility/dead-letter behavior, completed-schedule deletion, and invocation authentication without embedding application secrets.
- [ ] Implement adapters; no in-memory timer as reliable transport. Missing configuration must be explicit, not a silent successful no-op.
- [ ] Validate IaC locally, test adapters with mocked clients, and list exact future configuration and IAM actions/resources in the runbook.

## Task 3: Outbox retries and future newsletter dispatch

**Files:** `services/email-outbox.service.ts`, `services/email-dispatch-trigger.service.ts`, `repositories/email-outbox.repository.ts`, `services/newsletter-campaign.service.ts`, `app/api/v1/internal/email/process/route.ts`, new event-consumer service/route or worker under `infrastructure/aws/email-events/`; `tests/orders/email-infrastructure.test.ts`, `tests/orders/newsletter-campaign.test.ts`, new transport tests.

**Interfaces:** Task 2 transport is injected into post-commit dispatch and retry scheduling. Existing Outbox IDs, event keys and Resend idempotency keys remain authoritative.

- [ ] Add failing tests for immediate success, provider failures followed by retries at 1/5/30 minutes, terminal FAILED after four total attempts, stale SENDING recovery, transport failure, and duplicate events.
- [ ] Integrate immediate durable dispatch; retain visible durable failure state/manual reconciliation for the database-to-queue atomicity gap. Do not promise unconditional exactly-once delivery.
- [ ] Schedule retries only after failure; reconcile send-state persistence ambiguity with the unchanged provider idempotency key. Do not let expired retry events overwrite SENT.
- [ ] Test and implement future campaign scheduling, rescheduling/cancellation validation and batch continuation; recheck Neon recipient/consent state at actual send time.
- [ ] Remove dependency on recurring recovery for the new configured path. Document that Production reliability acceptance is blocked until infrastructure is provisioned; do not enable legacy schedules as fallback.
- [ ] Run email, auth-token and newsletter focused tests with deterministic time and no real email sending.

## Task 4: Staff inquiry notifications

**Files:** `repositories/contact-inquiry.repository.ts`, `services/contact-inquiry.service.ts`, `services/email-template.service.ts`, `tests/orders/contact-inquiry.test.ts`, `tests/orders/contact-support.test.ts`.

- [ ] Add failing tests for bounded/escaped customer name/email, available subject/category, summary, timestamp and authenticated Admin link; ensure customer notifications remain unchanged.
- [ ] Reuse transactional Outbox enqueue and configured `CONTACT_RECIPIENT_EMAIL`; do not invent recipients or expose content in logs/events.
- [ ] Route failures through Task 3 retry path and verify message/outbox atomicity and duplicate protection.
- [ ] Run inquiry/email focused tests; absent local recipient configuration is reported, not filled with a placeholder.

## Task 5: Event-driven Admin refresh and idle behavior

**Files:** `lib/admin-inquiry-polling.ts`, `components/admin/inquiry-notifications.tsx`, `components/admin/inquiry-detail.tsx`, `tests/orders/admin-inquiry-polling.test.ts`; new idle helper/test if needed.

- [ ] Add fake-clock tests proving no 30-second interval, one initial request, focus/hidden-to-visible/manual/local-event refresh, coalesced overlapping events, and no new hidden-page requests.
- [ ] Implement event-only refresh with cleanup and cancellation of background reads where possible.
- [ ] Add genuine interaction tracking: after 15 minutes idle no automatic refresh; first resumed activity refreshes once. Programmatic requests do not reset activity.
- [ ] Verify multiple-tab listeners do not create periodic polling; preserve unread/read-marker behavior.

## Task 6: Server-enforced Admin idle session

**Files:** `lib/admin-session.ts`, `services/admin-authorization.service.ts`, `proxy.ts`, `app/api/v1/admin/auth/login/route.ts`, new `app/api/v1/admin/auth/activity/route.ts`, Admin activity client; corresponding Admin authorization/session tests.

**Interface:** Signed token carries issued/absolute expiry and last accepted activity deadline. Server rejects at 60 minutes without activity; explicit same-origin activity renewal cannot extend the existing absolute ceiling or revive expired tokens.

- [ ] Add failing boundary tests for 59/60 minutes, absolute expiry, tampering, inactive accounts, developer checks, cross-origin renewal, missing legacy idle claim and Customer isolation.
- [ ] Implement shared verification across proxy/page/API paths; fail closed for legacy tokens without an enforceable idle deadline, requiring Admin re-login after rollout.
- [ ] Renew HttpOnly signed cookie only from throttled genuine interaction, not polling/prefetch. Use current DB account checks; do not reuse lastLoginAt as per-session state.
- [ ] Test hidden/idle clients and multi-tab renewal; document that this is signed-token idle enforcement, not a new persisted session-revocation store.
- [ ] Run Admin and Customer authorization regression tests.

## Task 7: Operating defaults, health semantics and documentation

**Files:** `config/smaregi.ts`, `config/operations.ts`, `services/operations-health.service.ts`, `repositories/operations-health.repository.ts`, `README.md` (new), four `docs/0*.md` source-of-truth documents, existing AWS trigger READMEs, new email-events runbook; operations/Smaregi tests.

- [ ] Before implementation, update source-of-truth documentation to reflect the approved design; preserve historical specs as historical records.
- [ ] Set documented formal Smaregi default to 24h and retain existing manual sync, last-sync display and storefront stock caveat.
- [ ] Describe reservation cleanup as future daily 03:00 JST maintenance; email as event-driven. Distinguish old resource names from their intended future cadence.
- [ ] Replace stale 5m/10m/15m health assumptions with pending-work/event-delivery checks and daily-sync expectations; no emails must not imply an unhealthy worker.
- [ ] Document all three schedules as DISABLED, manual execution methods and launch checklist. No AWS writes or actual job invocation.

## Task 8: Full acceptance and Git handoff, without deployment

- [ ] Run `pnpm test:orders`, `pnpm test:products`, `pnpm test:smaregi`; include new tests in these globs.
- [ ] Run full `pnpm test:e2e` once against a safe test database, without new retry/skip/timeout workarounds. Stop on failure and preserve safe evidence.
- [ ] Run `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm exec prisma validate`, `pnpm build`, `git diff --check` and local IaC validation.
- [ ] Review changed paths and diff; verify no legal drafts, secrets, Production env, migration or unrelated edits are included. Confirm infrastructure remains definition-only.
- [ ] Read-only verify existing Scheduler states if current AWS access permits; do not invoke maintenance workers to test them.
- [ ] Commit scoped changes as `feat: reduce background database wakeups`; integrate safely into main and push without overwriting unrelated work. Check CI/deployment hooks first: if pushing main auto-deploys, stop and resolve the user's no-deploy constraint before push.
- [ ] Final report: changed files, behavior/tests, no-migration status, future AWS resources/minimal IAM/config, disabled schedules, expected idle behavior, commit/push and explicit NOT DEPLOYED status.
