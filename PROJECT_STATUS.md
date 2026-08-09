# PROJECT_STATUS

Project: Sake Shop EC Website

Status: Active Development

Last Updated: 2026-08-10

---

# Current Milestone

Milestone 2 — System Foundation

Current Sprint: Sprint 12 — Smaregi Platform API

---

# Sprint Progress

| Sprint    | Name                                 | Status    |
| --------- | ------------------------------------ | --------- |
| Sprint 1  | UI Demo                              | Completed |
| Sprint 2  | Architecture & Documentation         | Completed |
| Sprint 3  | Project Infrastructure               | Completed |
| Sprint 4  | Prisma Database Schema               | Completed |
| Sprint 5  | PostgreSQL & Migration               | Completed |
| Sprint 6  | Product Module                       | Completed |
| Sprint 7  | CMS / Featured Collections           | Completed |
| Sprint 8  | Admin CMS                            | Completed |
| Sprint 9  | Admin Authentication & Authorization | Completed |
| Sprint 10 | Order System                         | Completed |
| Sprint 11 | Shipping Foundation                  | Completed |
| Sprint 12 | Smaregi Platform API                 | Pending   |
| Sprint 13 | Shipping (Sagawa)                    | Pending   |
| Sprint 14 | Testing & Optimization               | Pending   |
| Sprint 15 | AWS Production Release               | Pending   |

---

# Current Sprint Goal

Sprint 12 — Smaregi Platform API

---

# Next Sprint

Sprint 12 — Smaregi Platform API

---

# Customer Confirmed

- Physical Store
- Alcohol EC sales
- Smaregi POS
- Shared inventory
- Sagawa Shipping

## Waiting Confirmation

- EC Payment Provider
- Smaregi Platform API Permission
- Shipping Fee Rules
- Packaging Rules

---

# Technical Decisions

Frontend: Next.js App Router, TypeScript, Tailwind CSS

Backend: Route Handlers, Service Layer, Repository Pattern

Database: PostgreSQL (Neon), Prisma ORM

Validation: Zod

Source of truth:

- Smaregi: product, category, price, inventory
- Website: customer, orders, payments, shipments, CMS, admin, audit logs, sync logs

Website stores mirror data only for Smaregi-owned data.

---

# Blockers

None for Sprint 12.

---

# Git Status

Branch: main

Latest Completed Sprint: Sprint 11

---

# Notes

Do not start a new sprint until the current sprint has been completed and verified.
All AI development agents must read `AGENTS.md`, `PROJECT_STATUS.md`, and `docs/` before starting work.
