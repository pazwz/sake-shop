# Admin Inquiry Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline, as authorized by the user.

**Goal:** Independent Admin workspace with secure per-admin inquiry unread.
**Architecture:** Route-specific auth -> inquiry service -> repository -> Prisma. Root is neutral; public pages share StorefrontLayout.
**Tech Stack:** Next.js App Router, TypeScript, Prisma, PostgreSQL, Zod, Playwright.
**Spec:** docs/superpowers/specs/2026-10-02-admin-inquiry-workspace.md

## Global Constraints

- Additive migration only; nullable historical Customer author remains NULL.
- Exact displayed message IDs, per-admin read state, strict server authentication.
- Preserve existing page paths, user legal edits and storefront behavior.
- 30-second foreground polling; no new email/browser notification feature.
- Only current migration pending before Production DDL; migration precedes push.

## Review Focus

- Concurrent/equal-timestamp messages must remain unread unless individually displayed.
- Admin A read must not acknowledge Admin B.
- Hidden tab and unmounted polling must not keep fetching.
- Admin login/logout and Customer cookies must not cross identities.
- Legacy NULL authors and empty threads must remain renderable.

### Task 1: Read model, inbox and APIs

**Files:** prisma/schema.prisma, new additive migration, repositories/contact-inquiry.repository.ts, services/contact-inquiry.service.ts, validators/contact-inquiry.validator.ts, admin read/summary routes, tests/orders/admin-inquiry-workspace.test.ts.
**Interfaces:** list(input, adminId), unreadSummary(adminId), markAdminRead(inquiryId, messageIds, adminId). Existing customer methods unchanged.
- [ ] Write tests for explicit read IDs, direction validation, isolation and new sender.
- [ ] Run focused tests and confirm missing behavior fails.
- [ ] Add read markers/schema, indexed SQL sorting/pagination, authenticated APIs.
- [ ] Generate Prisma client locally and run focused tests to PASS.

### Task 2: Workspace and inquiry UX

**Files:** app/layout.tsx, components/storefront-layout.tsx, public directory layouts, components/admin/workspace.tsx, app/admin/layout.tsx, inquiry list/detail, admin dashboard, config/contact-inquiry.ts, E2E admin inquiry flow.
**Interfaces:** summary metadata and strict messageIds read endpoint from Task 1.
- [ ] Add browser assertions for workspace, dual sessions, thread ordering/read and pagination.
- [ ] Separate navigation/providers without changing public URLs; use existing tokens.
- [ ] Implement polling lifecycle, explicit rendered-ID acknowledgement, inbox and thread.
- [ ] Run unit tests and isolated E2E.

### Task 3: Verify, review and gated release

**Files:** source-of-truth docs and scoped feature files only.
- [ ] Run orders/products/smaregi, tsc/lint/prisma validate/build/diff check.
- [ ] Independent whole-change review and fix important findings with regression tests.
- [ ] Read-only Production preflight, additive deploy, status/schema/count verification.
- [ ] Scoped commit and push main; verify exact-SHA Production deployment and test-only smoke.

Commit steps are consolidated after QA and migration, matching user rollout order rather than committing partial stages.
