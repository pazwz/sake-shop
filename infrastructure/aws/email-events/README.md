# Email events — NOT provisioned / NOT deployed

## Production application identity (Phase 2B-1)

`sake-shop-production-email-app` trusts only `https://oidc.vercel.com/latte-moca`, audience
`https://vercel.com/latte-moca`, subject `owner:latte-moca:project:sake-shop:environment:production`.
The reproducible trust document is `production-app-trust.json`; no wildcard subject is used.
Only the existing Production ApplicationPolicy is attached. It remains SendMessage on the exact
Production queue, Create/Delete on `schedule/sake-shop-production-email-once/email-*`, and PassRole
on the exact Production Scheduler role conditioned on Scheduler service. GetSchedule stays denied.

Production-only non-secret `EMAIL_EVENT_APP_ROLE_ARN` selects this exact role. Email clients use the
pinned official Vercel OIDC AWS provider with 900-second STS sessions, never media/static credentials.
The media S3 client and its environment variables are unchanged. Preview cannot select this role.
The existing Bearer protects the Production-only `/api/v1/internal/email/identity` probe. It checks
STS caller identity, creates a DISABLED future identifier-only `email-identity-probe-*` schedule,
then allows explicit cancellation. Operators read the schedule with their existing identity.
No DB, Queue publication or email provider is used. Queue SendMessage/negative permission cases
are checked with IAM simulation; real business delivery is deferred to separately authorized 2B-2.
Keep both consumers and the three legacy schedules disabled throughout 2B-1.

## Production Phase 2A callback preparation (2026-10-17)

Production application and Worker both require the explicit stable endpoint
`https://linxas-fukuoka.com/api/v1/internal/email/process`. No public-site/deployment fallback
is permitted in Production. Existing Production application Bearer is reused; it is distinct
from Preview auth. Production does not use Preview protection cookies or local Vercel credentials.
The no-store `GET /api/v1/internal/email/health` returns 204 only for the correct Bearer,
401 for missing/wrong auth, without DB, queue or provider work. Direct Worker invocation
`{"kind":"auth-probe"}` uses the same SSM credential and calls health only, failing on any
response other than 204. Never use a process `{}` request as a probe: it republishes pending work.
Malformed JSON is rejected before operations logging. Consumer activation is separately gated;
Phase 2A leaves Production/Preview consumers and all legacy schedules disabled.

## Isolated Preview callback authentication

The authorized Preview environment has its own database, Queue, DLQ, Scheduler group and Worker.
Do not use Production resources or credentials. `PREVIEW_EMAIL_ALLOWED_RECIPIENT` is required for
Preview Resend delivery; a mismatch is rejected, never rewritten.

Public URL selection remains separate from internal dispatch. In Preview, `VERCEL_URL` identifies
the current deployment; an explicit `EMAIL_PROCESS_ENDPOINT_URL` must match that deployment and
the internal email route exactly. Missing current deployment metadata fails closed instead of
falling back to `NEXT_PUBLIC_SITE_URL`. Production endpoint behavior is unchanged.

Preview application self-dispatch uses its platform-provided OIDC request token (`x-vercel-oidc-token`,
read through the current Next.js request context; `VERCEL_OIDC_TOKEN` if provided) with the existing
application Bearer. It never uses a local login token. The token must be an unexpired Preview identity,
and `PREVIEW_EMAIL_DISPATCH_EXPIRES_AT` must still be in the authorized test window. Redirects and
HTML login responses are not queue acknowledgments. No Production protection settings are changed.

The Preview Worker requires `EMAIL_DEPLOYMENT_ENV=preview` to use a JSON SSM authentication bundle
containing `kind`, exact `endpoint`, application `secret`, `protectionCookie`, and `expiresAt`.
The deployment-scoped share grant and Cookie must expire within four hours. A different target,
missing auth layer or elapsed deadline fails closed; redirects are not followed. Production Workers
continue to use their existing plain application secret and are not deployed by Preview validation.

The local cloud test driver uses explicit `fromIni({ profile: 'default' })` only for Preview parameter
reads. It preserves media credentials and never configures the operations profile in Vercel.
Require an explicit `PREVIEW_E2E_ORIGIN` matching the current granted deployment. Cloud acceptance
status is recorded separately in `docs/PREVIEW_EMAIL_E2E_STATUS.md`.

This directory is a reviewed definition, not evidence of working Production infrastructure.
Do not apply it or change Production variables without a separate authorization.
The event source mapping is disabled by default. Never re-enable the legacy email recovery schedule.

## Proposed resources

Prefix: sake-shop-dev for isolated tests; sake-shop-production only after approval.
Queue: <prefix>-email-events; DLQ: <prefix>-email-events-dlq; Scheduler group:
<prefix>-email-once; Lambda: <prefix>-email-event-worker; 14-day log group;
worker role, Scheduler-to-queue role and unattached application managed policy.
One-time names are email-<48 hex characters>, derived from identifier payload and due time.
Successful one-time schedules delete themselves. The three existing recurring schedules remain DISABLED.

## Future configuration (not set by this change)

Application: EMAIL_EVENT_QUEUE_URL, EMAIL_EVENT_QUEUE_ARN, EMAIL_EVENT_DLQ_ARN, EMAIL_EVENT_SCHEDULE_GROUP,
EMAIL_EVENT_SCHEDULE_ROLE_ARN, and existing AWS region/approved AWS identity.
No new application secret is defined. Existing CRON_SECRET authenticates the existing internal endpoint.
Worker: EMAIL_PROCESS_ENDPOINT_URL and CRON_SECRET_PARAMETER (existing SSM name).
Build/archive must include index.mjs and the fixed-version @aws-sdk/client-ssm dependency;
the runtime SDK may also be used after separately verifying its version.
No secrets belong in CloudFormation parameters, payloads or logs.

## Minimum runtime IAM

- Application: sqs:SendMessage on the exact queue ARN; scheduler:CreateSchedule and
  scheduler:DeleteSchedule only in the dedicated group with email-* names; iam:PassRole only
  the Scheduler role, conditioned on iam:PassedToService=scheduler.amazonaws.com.
- Scheduler role: sqs:SendMessage only to the event queue and delivery DLQ; trust only
  scheduler.amazonaws.com, this account and this exact Scheduler group.
- Worker role: sqs:ReceiveMessage/DeleteMessage/GetQueueAttributes only on event queue;
  ssm:GetParameter only on the existing secret parameter ARN; logs:CreateLogStream/PutLogEvents
  only on its log group. If the existing SSM parameter uses a customer-managed KMS key,
  separately approve kms:Decrypt scoped to that key and SSM encryption context.
- Provisioning identity is separate from runtime identities. Do not give the web application
  permission to create queues, roles, Lambda functions, policies or recurring schedules.

## Delivery and reconciliation

Business transactions commit Outbox first. Existing post-commit authenticated HTTP handoff
publishes identifier events to SQS; it never supplies recipients or bodies. Provider failures
persist FAILED + nextAttemptAt and schedule an event after 1/5/30 minutes; four total attempts.
There is no pure-memory delivery timer. Queue visibility handles worker crashes; stale SENDING
is conditionally reclaimed after 10 minutes, with the unchanged Resend idempotency key.
The 360-second queue visibility exceeds six times the worker's 60-second runtime.
At least once transport does not imply exactly once external email sending.

If initial HTTP/queue publication fails after DB commit, Outbox remains durable and an existing
safe trigger failure is logged. It is NOT automatically rescued without a new event.
If scheduling fails, fail the queue record so redelivery repairs the handoff from persisted state.
DLQ messages require operator inspection and identifier-only redrive; never delete them blindly.
For PENDING or FAILED-due work, an operator may manually POST {} to the existing authenticated
internal email/process endpoint to republish eligible IDs. For a failed future campaign handoff,
repeat scheduling through Admin or publish the exact current campaign ID + scheduledAt after review.
Do not assume old recurring recovery exists.

Scheduled campaign events validate the exact scheduledAt against Neon, so cancelled/rescheduled
events cannot start stale work. Recipient enqueue is transactional and event-key deduplicated.
Re-delivered SENDING campaign events republish unsent work; Neon eligibility is checked before send.
Validate queue/DLQ, partial batch failure, stale lease, schedule exhaustion, cancellation, >20 recipients,
and real email delivery in an authorized non-production environment before any Production rollout.

## Local validation

Run focused email-event tests (mocked AWS clients and worker HTTP, no cloud writes), TypeScript,
and parse template.yaml with a local CloudFormation validator. No aws deploy command is part
of this task. Before launch obtain separate approval to provision, configure, enable the new
event source mapping, perform acceptance, and deploy application code in a coordinated rollout.
