# Isolated Preview email E2E — 2026-10-16

## Safety boundary

- Branch: `codex/low-cost-operations`; no merge or push to main.
- Production remains `f71a75e272f19ef07b83ff3ff21a67b0fb473e06`.
- No Production database access, business-data writes, real customer mail, or Production resource changes.
- Only approved recipient: `pazwz@yahoo.co.jp`. Never rewrite an unapproved recipient.
- `EMAIL_MODE=disabled` and `CHECKOUT_MODE=disabled` until isolated acceptance is ready.
- All three legacy schedules remain disabled; do not enable them for testing.

## Current acceptance — 2026-10-16 (supersedes historical progress below)

**COMPLETE: isolated cloud E2E passed. Production remains inactive/unchanged.**

- Current granted Preview: `https://sake-shop-gi77rj26f-latte-moca.vercel.app`.
- Deployment: `dpl_4xKVstBcwxD8fVzEEPVE1LQ84KTh`, READY, commit
  `cf9ff58729592f8c82ab41e6297ff959fda121a0` on the feature branch only.
- Public URL semantics unchanged. Internal Preview dispatch derives from current `VERCEL_URL`;
  an explicit internal endpoint must match. It uses the current platform-injected request OIDC
  identity plus application Bearer. Runtime evidence showed the token is in request context,
  not the ordinary environment variable. Missing/expired auth fails closed with safe reason codes.
- Worker uses the exact current deployment endpoint and its deployment-only access Cookie plus
  application Bearer. Fresh STS was issued for this final deployment (not copied from earlier
  deployments). Its grant deadline is 2026-10-16 18:33:45 UTC and application STS / dispatch
  test window ends at 18:30:32 UTC. Missing either auth layer returned 401; both returned 200.
- A failing boundary test proved handoff retries previously continued after the authorized window
  elapsed during their wait. Preview now rechecks auth before every attempt; Production is unchanged.
  The test went RED → GREEN (three requests before the fix, one request after expiry with the fix).
- Automatic Inquiry PASS: API HTTP 201 → Outbox `cmvb18npg0006l607esc1pms8` → automatic dispatch
  → Queue → Worker → protected callback → Resend SENT, attemptCount 1. No manual publish used.
- The preceding fresh-STS deployment repeated the same automatic chain successfully: Outbox
  `cmvb1tn9a0006l208taz0dv9q` became SENT, attemptCount 1, within five seconds.
- Expiry-guard deployment repeated automatic Inquiry successfully: Outbox
  `cmvb2jni00006kx08s12ulv3v` became SENT, attemptCount 1, within ten seconds.
- The same latest deployment passed duplicate delivery and repeated Newsletter acceptance:
  cancelled campaign `cmvb2lpg20008kx08pc80rlby`; SENT campaign `cmvb2lrf9000gkx08i6m4arzs`,
  21 rows (20 synthetic ineligible SKIPPED rows + one authorized test subscriber SENT).
  "SENT" means provider acceptance, not confirmed mailbox delivery (see SMTP blocker below).
- Final deployment also repeated duplicate / future Newsletter / cancel / reschedule / continuation:
  cancelled campaign `cmvb1wzlu0008l2087r3izjkv`; SENT campaign `cmvb1x1ef000gl208ivj17x7y`,
  21 rows (20 safely SKIPPED synthetic rows and one real authorized test subscriber SENT).
- Duplicate event PASS: replay of that SENT row left attemptCount and provider ID unchanged.
- Newsletter cancel PASS: cancelled campaign `cmvb1erly0008l607ng2nmia1` had its schedule removed.
- Newsletter reschedule PASS: old schedule removed; new identifier-only one-time payload verified.
- Future Newsletter / batch continuation PASS: campaign `cmvb1etfs000gl607qvt8bsbm` became SENT;
  21 Outbox rows = 20 synthetic ineligible SKIPPED rows + one authorized subscription SENT.
  This validates continuation without claiming 21 distinct subscribers or sending 21 messages.
- Controlled failure: Resend accepts an empty subject, so that initial failure probe sent one
  authorized test message. It is not counted as a retry failure. Reusing a delivered test row's
  provider idempotency key with changed content produces a safe persistent conflict instead.
- Retry cloud acceptance PASS. Strict driver verified actual 60/300/1800-second
  timestamp deltas, exact schedule expression, no early attempts, terminal fourth failure and
  unchanged provider ID. The strict chain reached terminal FAILED at attempt 4.
- Strict observed deltas: 59,999ms / 299,999ms / 1,799,998ms; schedule expressions match.
  Final fourth attempt was due at 2026-10-16 14:42:39 UTC and completed after its due time.
  No early retry was observed. Strict chain: `cmvb1iy2o0000v8blmafwv3t3`.
- First controlled-conflict retry chain completed: `cmvb1bz8k0000v8ueuorhnkhb` reached terminal
  FAILED at attempt 4 with no new provider message. Both controlled-failure chains passed.
- Read-only Resend webhook check: the existing Production webhook is Disabled. It was not modified.
- SMTP delivery temporarily showed a separate external blocker: the selected test message to
  `pazwz@yahoo.co.jp` is Sent / Delivery Delayed in Resend. Yahoo returned SMTP 421, deferral
  code 4.16.50 (temporary receiver-side deferral). This is not evidence of inbox delivery.
  Do not claim full mailbox delivery PASS, change the recipient, or modify Production mail/DNS.
- Latest deployment's actual Newsletter `01a14526-6431-7af9-8354-c13eb59f21f8` is confirmed
  **Delivered** to the approved test address in Resend. Latest Inquiry
  `01a14522-d6ec-7bfa-aad1-419653704636` then remained Sent / Delivery Delayed.
- SMTP blocker RESOLVED for the latest acceptance messages: read-only Resend inspection confirmed
  the latest Inquiry was **Delivered** at 2026-10-16 14:54 UTC, after temporary Yahoo deferral.
  Both latest Inquiry and Newsletter are now Delivered to the single approved test address.
  No recipient change, extra resend, Production mail/DNS change or third-party coordination was used.
- Final isolated SQL audit ended at 2026-10-16 14:48:58 UTC. All Customer, subscription and
  Outbox recipients match the single approved address. Eight provider messages were accepted
  (including two deliberate seed messages). Both controlled retry rows are FAILED / attempt 4 /
  nextAttemptAt NULL; 60 synthetic continuation rows are SKIPPED. Three historical failed-handoff
  PENDING test rows were preserved as failure evidence, not manually republished to claim success.
  No SQL observer remains running; further idle checks use only the Neon control plane.
- Neon control-plane suspend timeout `0` means plan default, not disabled scale-to-zero (`-1`).
  Confirmed against the CLI's official API schema; no Neon settings were changed.
- Neon automatic idle PASS: at 2026-10-16 14:57:23 UTC the control plane reported `idle`,
  with last activity still 14:48:58 UTC. No manual suspend, plan change or timeout setting change.
  The only remaining local observer reads AWS DLQ metadata, not SQL; invalid DLQ probe callbacks
  fail validation before business/database processing and did not keep the Test DB awake.
- Timed provider retry chains started in the same isolated DB/Queue before the final auth-expiry
  guard redeploy and completed through the latest protected callback. Their provider retry
  implementation/timing was unchanged; automatic Inquiry, duplicate and Newsletter acceptance
  were repeated on the latest deployment itself.
- Worker/DLQ probe `ff1ffb18-936f-410b-b597-4a4b8e142805` was published around 13:58 UTC with
  an invalid identifier-only test event. It must fail validation before business processing;
  actual Worker redrive reached DLQ at 15:10:48 UTC, observed receive count 13. PASS.
  Only this disposable test message was removed. Source and DLQ were both confirmed empty.
  Queue settings were not shortened for this test.
- Latest local checks: Orders 270/270, Products 166/166, Smaregi 76/76; TypeScript, lint,
  independent-test-DB build and diff check passed. No dependency upgrades.
- Production consumer mapping `6636a1e1-4183-4f47-93a3-d6e1b4f71410` is Disabled.
  All three historical schedulers remain DISABLED. Preview consumer
  `6c96beed-fd11-4d39-9eb8-d26932926ff4` was restored to Disabled after acceptance.
- Temporary branch-scoped `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` and
  `PREVIEW_EMAIL_DISPATCH_EXPIRES_AT` were retired from future Preview builds. Existing granted
  deployment deadlines were not extended. No AWS resources or permanent credentials were deleted.
  Next authorized Preview testing requires fresh short-lived application credentials/test window.
- Vercel Production environment metadata was compared before/after retirement and remained unchanged.
  Five Preview Queue/Scheduler configuration keys, independent Test DB, limited Resend key and
  recipient allowlist remain configured. No Production DB writes or real customer emails occurred.
- Application commit `cf9ff58` was pushed only to `codex/low-cost-operations` and deployed only as
  Preview. Production remains READY at `f71a75e272f19ef07b83ff3ff21a67b0fb473e06`.
  Acceptance evidence/driver are kept locally without another Preview build or Test DB wake-up.
- No application blocker remains. Production activation still requires separate authorization:
  review/merge the feature branch, approved Production runtime configuration/identity, Production
  deployment, then controlled consumer activation and Production-safe acceptance. Do not enable
  the three historical recurring schedulers as part of this isolated test's completion.

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

## Cloud acceptance progress / stopped on 2026-10-16

- Current application deployment: `https://sake-shop-pgv6iuqcd-latte-moca.vercel.app`,
  READY at approved commit `8f1e3d78a994eb684b3ddff4e0ca611e5fab56c6`.
- Preview application identity: `sake-shop-preview-email-app`, only the reviewed Preview application policy.
  STS expiration: 2026-10-16 17:14:04 UTC. No operator credential was configured in Vercel.
- Deployment-only share grant / Cookie expires no later than 2026-10-16 17:17:11 UTC.
  Preview Worker additionally enforces an earlier local deadline and an exact callback endpoint.
- Deployment access plus application Bearer: internal NOOP returned HTTP 200; missing Bearer returned
  application `UNAUTHORIZED` 401. Checkout returned 200 with the preparation notice.
- Preview Queue/DLQ infrastructure-only redrive probe reached 12 receives, moved to DLQ and was removed.
  This did not invoke the Worker or validate business delivery.
- Worker-only protected callback adapter has five passing focused tests, including expired and wrong-target rejection.
  Its source changes are local and have not changed the approved Vercel application commit or Production Lambda.
- Local test driver now constructs only its SSM client with `fromIni({ profile: 'default' })`.
  Preflight verified the existing operations identity, successful Preview parameter read, media credentials
  not selected, and no mutation of media environment variables. No IAM grant was added for this fix.

### Actual automatic Inquiry failure

Synthetic Customer login succeeded; the Preview Inquiry API returned HTTP 201 and created Outbox
`cmvb09b4k0006js08v64a5xo0`, addressed only to the approved test email.
After 30 seconds it remained PENDING, attemptCount 0, lastError null; Preview Queue was empty.
The driver stopped with `IMMEDIATE_INQUIRY_NOT_SENT`. It did not manually republish the notification.

Read-only Config inspection confirmed the branch's `NEXT_PUBLIC_SITE_URL` is still
`https://sake-shop-6ixd2x96h-latte-moca.vercel.app`; `EMAIL_PROCESS_ENDPOINT_URL` is absent.
The current dispatch trigger derives its target from that old site URL and supplies only the application
Bearer, without authentication for Vercel Deployment Protection. `EMAIL_MODE=resend`,
`CHECKOUT_MODE=disabled` and the approved recipient allowlist were separately confirmed.

The new failure is not AWS credential resolution and cannot be repaired solely by changing the local
driver. Do not silently use a manual publish or a driver override as proof that automatic Inquiry works.
Preview consumer was disabled again. No test email was sent. Retry, duplicate, scheduled campaign,
batch continuation, cancel/reschedule and business Inquiry acceptance remain pending.
