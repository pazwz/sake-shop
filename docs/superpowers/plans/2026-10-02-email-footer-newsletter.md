# Shared Email Footer and Newsletter Delivery Plan

> **For agentic workers:** Use TDD and parallel independent UI/footer tasks; execute the backend and integration here. User approved the complete in-chat design and instructed execution without another approval pause.

**Goal:** Consistent LINXAS email footer and secure, scanner-safe newsletter signup/unsubscribe.
**Architecture:** Existing Route → Service → Repository → Prisma; Neon consent is source of truth, existing Outbox is the async Resend mirror. No schema changes.
**Tech Stack:** Next.js App Router, TypeScript, inline email HTML tables, Prisma, Node crypto, existing Resend SDK.
**Spec:** User confirmation in this chat (19 explicit requirements, 2026-10-02).

## Global constraints

- Preserve and exclude unrelated legal/footer changes. No migration, seed, Product/Inventory/Smaregi/Checkout changes.
- Footer uses https://linxas-fukuoka.com and confirmed siteConfig information only; no seller address or unpublished alcohol-management page.
- Newsletter signup requires consent. GET unsubscribe reads only; confirmation and standard one-click use POST without login.
- Opaque new tokens retain legacy signed-link/hash compatibility; verification/reset token behavior is unchanged.
- Transactional and Admin test emails have no functional newsletter unsubscribe link/header.
- Production smoke only on explicitly identified test subscription; never send to a real audience.

## Review focus

- Email scanners must not mutate through GET; invalid tokens do not reveal identity or reason.
- Existing subscription hashes and legacy links survive token envelope upgrade.
- Resubscribe followed by another unsubscribe must enqueue a new mirror transition; stale mirror jobs cannot restore subscribed state.
- Formal campaign missing subscription identity fails closed; explicit Admin test mode remains usable.
- Confirmation pages must not leak bearer credentials through referrer, caching or logs.

## Task 1 — Backend (main)

Files: lib/newsletter-unsubscribe-token.ts, NewsletterService/Repository, existing unsubscribe route, dedicated one-click route, campaign gate, EmailOutboxService, tests/orders/newsletter-unsubscribe.test.ts.
- [x] RED: opaque/legacy/tampered token, read-only inspection, POST and one-click, idempotency/consent cycles, send gate.
- [x] Authenticated encrypted envelope of existing HMAC token; derive unchanged canonical DB hash. No DB backfill.
- [x] Produce getUnsubscribeState(token): Promise<'confirm'|'already'|'invalid'>; keep unsubscribe result {unsubscribed:true}.
- [x] Keep mirror asynchronous and consent final check fail closed.
- [x] GREEN focused tests.

## Task 2 — Shared footer (parallel isolated files)

Files: email-brand-config, SharedEmailFooter, EmailTemplateService, EmailMessage types/Resend adapter, read-only Admin preview, rendered-footer tests.
- [x] RED existing render missing footer/headers; GREEN HTML/plaintext tests, canonical links, safe size and mobile layout.
- [x] Use createNewsletterUnsubscribeToken(id), public body confirmation URL and separate one-click URL.

## Task 3 — Public/customer UI (parallel isolated files)

Files: /newsletter, /newsletter/unsubscribe, corresponding client components, Customer preference consent/focus refresh, composed E2E.
- [x] RED missing pages/states; GREEN signup consent, GET unchanged, POST, repeat/invalid, My Page, consent reset.

## Task 4 — Integration and delivery

- [x] Review full change and fix significant findings with regression tests.
- [ ] Final release gate: email/newsletter/customer suite, products, Smaregi, full safe E2E, TypeScript, lint, guarded E2E build, diff check (latest full E2E still has one failure).
- [x] Save local HTML/plaintext and desktop/mobile screenshots (not actual Gmail/Outlook delivery claims).
- [ ] Scoped commit/push main and exact-SHA Vercel Production success.
- [ ] Approved test-only Production smoke if credentials/test subscription are available; otherwise report precise blocker.

## Review outcomes

- Formal newsletter envelopes are stable for identical immutable signed plaintext, preserving Resend request-body idempotency on Outbox retries.
- A post-sync Neon check detects in-flight consent changes and leaves stale mirror jobs eligible for async reconciliation.
- Subscription mutations use a conditional update, preserving repeated opt-out timestamps and avoiding duplicate transition jobs.
- Local preview script renders five HTML/plain-text templates and desktop/mobile screenshots without any network or email calls.
- Production inbox delivery needs an explicitly identified test subscription and mailbox access; never substitute a real audience.

## Validation and release status

### Resumed on latest main (2026-10-02)

- Base: `41a9f203ee66f5b094c1a35818b32ecc9e514877`, including the independent Product read-path repair. Latest Admin/Product code preserved.
- Re-applied the latest Admin documentation hunks onto the pending Newsletter documentation; the final documentation diff is Newsletter-only.
- Final focused email/newsletter/customer tests: 60 passed. Final release-only export Orders 218 (legal draft tests excluded), Products 162, Smaregi 76; all zero failures. Explicit harmless local signing secret supplied to unit tests.
- Full working-tree Playwright: 20 collected / 18 passed / 2 existing fixture skips / 0 failed. No retry, timeout increase, new skip, or weakened assertion.
- Initial resumed full run failed on an isolated pooled connection initialization and a stale test fixture signature. The Newsletter E2E now prepares only its guarded fixture's token hash for the current test secret and restores its original hash; application token/hash behavior is unchanged.
- TypeScript, lint, Prisma validate, build and diff-check passed. The release-only export also builds after removing stale dependency-symlink build artifacts; no Next configuration change.
- Six offline HTML/plain-text templates and twelve 390px/900px screenshots generated; no horizontal overflow. These are browser previews, not real Gmail/Outlook delivery evidence.
- Final independent review: no Critical/Important findings. Deferred minor: if the E2E preference-restoration PATCH fails, nested finally blocks could further guarantee token-hash/context cleanup; no Production logic is involved.
- RFC 8058 source check found that receivers may send multipart/form-data. Added a failing 422-versus-200 test, then accepted both standard form encodings via Request.formData; bearer validation and idempotency remain unchanged.
- Post-RFC final release-only full E2E: 17 passed / 2 existing skips / 1 failed. Existing Admin inbox test failed at its initial Prisma query with PrismaClientInitializationError: isolated Neon pooler unreachable. Unchanged manual rerun: 17 passed / 2 existing skips / 1 failed; Admin and Newsletter passed, but existing notification flow timed out waiting for the browser load event in page.waitForURL (30 seconds). The snapshot already shows the correct order-message page and rendered history; this second failure is not confirmed P1001 and its underlying resource-load cause is unproven. No retries, timeout increases, assertion changes or new skips were introduced. Commit/push/deploy remain blocked by the required zero-failure gate.
- Final offline previews regenerated: six HTML/plain-text templates and twelve screenshots at 390px/900px, no horizontal overflow. Actual Gmail/Outlook delivery, DKIM coverage of unsubscribe headers and mailbox one-click affordance remain unverified without an explicitly approved accessible test mailbox.
- Production audit found provider simulation and real customer domains, but no confirmed accessible real test mailbox. Do not send to real customers or claim simulated delivery as inbox acceptance.

### Earlier blocked run (historical)

- Newsletter composed browser acceptance passed; isolated Admin dual-session/inbox acceptance also passed without code changes.
- Full Playwright runs collected 18 tests: each ended with 15 passed / 2 optional fixture skips / 1 failure. The first failure was Admin login HTTP 500; the second was the existing public-cart test waiting for product cards while the page remained loading.
- Initial isolated pooler connectivity failure was directly observed. Neither later full-suite failure has enough evidence to label it P1001.
- Do not change unrelated business code, add retries, or weaken assertions. The all-green release gate remains unmet: no commit, push, deploy, or Production smoke in this run.
