# Product Read-Path Performance Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution. Preserve the existing Admin implementation.

**Goal:** Identify the reproducible Product E2E timeout independently of Admin changes, fix its proven cause minimally, and release only after all requested gates pass.

**Architecture:** Retain Route → Service → Repository → Prisma, public visibility and fresh inventory semantics. Diagnose with external local-only measurement scripts first; do not introduce application retries or mask errors.

**Tech Stack:** Next.js, Prisma/PostgreSQL, Playwright, TypeScript.

**Spec:** `/Users/shu/.codex/attachments/d732ab88-b6c7-4a50-89e0-721d6d16cee7/已粘贴的文本.txt`

## Global Constraints

- Preserve Admin changes and all primary-workspace draft hashes.
- No Production data writes, seed, migration, Smaregi calls, real email, timeout increases, retries, skips or weaker assertions.
- Measure the unchanged base commit and Admin tree against the same isolated E2E database and tests, at least three runs each.
- Any performance/test fix is committed separately from Admin changes.
- Commit/integrate/push only after the two Product tests each pass five consecutive runs, full E2E has zero failures, and all named QA gates pass.

## Review Focus

- Hidden/excluded/retired products must retain anonymous 404 and remain absent from lists.
- Preview must still require a valid active Admin and signed product-scoped token.
- Inventory/reservation availability must remain fresh, without public shared caching.
- Measurements must not log database credentials, customer data or token values.
- Baseline and modified-tree tests must use identical fixture identities/configuration, not Production.

### Task 1: Baseline and instrumentation

- [ ] Create a clean diagnostic worktree at base `5e54baeebed8429fdd95dfc934622014a2520f52`; keep main drafts untouched.
- [ ] Audit Product list/detail, proxy, header, repositories, connection configuration and all synchronous outbound requests.
- [ ] Measure SQL operation count and duration, connection establishment, HTTP TTFB/complete duration, browser navigation/hydration and image requests without changing business logic.
- [ ] Run each failing Product test at least three times on each tree; request one identical detail endpoint five times and record cold/warm differences.
- [ ] Classify the cause using evidence; do not attribute network latency to quota without direct evidence.

### Task 2: Proven minimal repair

- [ ] Add a regression test that fails for the identified cause.
- [ ] Implement only the minimal performance or test-readiness correction, preserving public security/availability behavior.
- [ ] Verify the regression test and each Product browser test five consecutive times, without retry or timeout changes.
- [ ] Run full E2E, Orders, Products, Smaregi, tsc, lint, Prisma validate, build and diff-check.

### Task 3: Scoped delivery

- [ ] Commit performance/test repair separately, then scoped Admin changes; verify commit file lists.
- [ ] Integrate the exact commits into main while preserving original email/legal draft contents; verify hashes.
- [ ] Push main and verify exact-SHA Production Ready through authorized deployment status access.
- [ ] Run read-only/test-only Admin smoke within existing safety boundaries; report any email/auth permission blocker explicitly.
