# Isolated Preview email E2E — 2026-10-16

## Safety boundary

- Branch: `codex/low-cost-operations`; no merge or push to main.
- Production remains `f71a75e272f19ef07b83ff3ff21a67b0fb473e06`.
- No Production database access, business-data writes, real customer mail, or Production resource changes.
- Only approved recipient: `pazwz@yahoo.co.jp`. Never rewrite an unapproved recipient.
- `EMAIL_MODE=disabled` and `CHECKOUT_MODE=disabled` until isolated acceptance is ready.
- All three legacy schedules remain disabled; do not enable them for testing.

## Prepared

- Independent empty Neon project: `sake-shop-preview-e2e` / `cold-bread-74303000`, Singapore.
- Initial public table count was zero; all 24 current migrations were applied.
- One explicitly authorized test Customer and one NewsletterSubscription; no initial Outbox rows.
- Base Preview: `https://sake-shop-6ixd2x96h-latte-moca.vercel.app`, READY at `89bfb529`.
- Branch-only database and authentication variables; no Production credential reuse.
- Separate Resend key `sake-shop-preview-e2e`, Sending access only, domain `mail.linxas-fukuoka.com`.
- Resend key stored as a Secret only on Preview branch `codex/low-cost-operations`.
- `PREVIEW_EMAIL_ALLOWED_RECIPIENT` is set on that branch. Preview Resend sends fail closed if
  missing or if the recipient does not match; the safe log contains only `PREVIEW_EMAIL_RECIPIENT_REJECTED`.
- Preview callback secret: SSM SecureString `/sake-shop/preview/email-event-secret`; independent
  branch-only `CRON_SECRET`. No secret value belongs in this report, Git, or logs.
- Independent AWS stack `sake-shop-preview-email-events` uses the reviewed template with prefix
  `sake-shop-preview`; event consumption is disabled and the application policy remains unattached.

## Callback / runtime identity gate

The existing Vercel project protects Preview deployments. An unauthenticated request to the
Preview email callback returned HTTP 302 before application authentication. The reviewed
worker sends only the application Bearer credential, not Vercel Deployment Protection credentials.
Do not disable protection on the Production-linked project or copy local Vercel authentication
credentials into Lambda as an implicit workaround.

No AWS runtime credentials are configured in Preview. Never copy the local `sake-shop-admin`
credentials into Vercel. Before activation, establish an explicitly approved Preview-scoped
application identity and a callback access path that leaves Production settings unchanged.

## Local verification for the recipient guard

- RED observed for missing allowlist and forbidden-recipient rejection before implementation.
- Orders tests: 250 passed, 0 failed.
- Products tests: 166 passed, 0 failed.
- Smaregi tests: 76 passed, 0 failed.
- TypeScript, lint, isolated-test-DB build and diff check passed.
- These are not evidence of cloud delivery. No test email was sent.

## Still unverified

Immediate delivery, actual 1/5/30-minute retries and terminal failure, duplicate external delivery,
DLQ receive exhaustion, scheduled Newsletter, batch continuation, cancel/reschedule, Inquiry
notification and measured Neon idle behavior all remain pending. Do not report these as passed.
