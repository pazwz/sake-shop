# AGENTS.md

# Sake Shop Project

## Purpose

This repository contains the source code for a Japanese liquor EC website.

The project is developed using an architecture-first approach.

Before making any code changes, always read the project documentation under `/docs`.

---

# Source of Truth

The following documents are the only source of truth.

Read them before every task.

docs/

- 01_REQUIREMENTS.md
- 02_SYSTEM_ARCHITECTURE.md
- 03_DATABASE.md
- 04_API_SPEC.md

If code conflicts with documentation:

Documentation wins.

Do not silently change the architecture.

---

# Development Principles

Always follow:

Requirements

↓

Architecture

↓

Database

↓

API

↓

Implementation

↓

Testing

Never implement features before the design exists.

---

# Architecture

Use layered architecture.

```
Route
    ↓
Service
    ↓
Repository
    ↓
Prisma
```

Rules:

- Route must never access Prisma directly.
- Business logic belongs only in Service.
- Repository only performs database operations.
- Validation must happen before Service.

---

# Technology Stack

Frontend

- Next.js (App Router)
- TypeScript
- Tailwind CSS

Backend

- Route Handlers
- Server Components
- Server Actions

Database

- PostgreSQL
- Prisma ORM

Validation

- Zod

---

# Database Principles

Smaregi is the source of truth for:

- Products
- Categories
- Prices
- Inventory

Website stores mirror data.

Website owns:

- Customers
- Orders
- Payments
- Shipments
- Featured Collections
- Hero
- CMS Content
- Admin
- Audit Logs

Do not create a second inventory system.

---

# API Rules

Use REST API.

Base path:

```
/api/v1/
```

Response format:

```json
{
  "success": true,
  "data": {},
  "message": "",
  "error": null
}
```

---

# Coding Rules

Use:

- TypeScript
- Prisma
- Zod

Avoid:

- any
- console.log
- duplicated code
- magic strings

Prefer:

- enums
- constants
- reusable utilities

---

# Folder Responsibilities

repositories/

Database access only.

services/

Business logic only.

validators/

Zod schemas.

types/

Shared types.

lib/

Framework utilities.

middleware/

Authentication, authorization, logging.

---

# Images

Never store image binary in database.

Database stores only URLs.

Development:

Local storage.

Production:

AWS S3.

---

# Git

Commit messages must follow Conventional Commits.

Examples:

```
feat:
fix:
docs:
refactor:
test:
chore:
```

---

# Before Commit

Always ensure:

```
pnpm lint

pnpm build
```

Both must pass.

---

# If Architecture Changes

Never modify architecture by yourself.

Instead:

Create an Architecture Review.

Explain:

- reason
- impact
- proposal

Wait for approval.

---

# Working Style

Prefer small commits.

Keep pull requests focused.

Do not refactor unrelated code.

Do not change UI unless requested.

Do not change database design unless documentation changes.

---

# Goal

Build a maintainable, scalable, production-ready EC system.

Maintainability is more important than development speed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
