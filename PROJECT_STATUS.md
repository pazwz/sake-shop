# PROJECT_STATUS

Project: Sake Shop EC Website

Status: Active Development

Last Updated: 2026-08-10

---

# Current Milestone

Milestone 2 — System Foundation

Current Sprint: Sprint 13 — Smaregi Platform API Integration

---

# Sprint Progress

| Sprint    | Name                                 | Status                             |
| --------- | ------------------------------------ | ---------------------------------- |
| Sprint 1  | UI Demo                              | Completed                          |
| Sprint 2  | Architecture & Documentation         | Completed                          |
| Sprint 3  | Project Infrastructure               | Completed                          |
| Sprint 4  | Prisma Database Schema               | Completed                          |
| Sprint 5  | PostgreSQL & Migration               | Completed                          |
| Sprint 6  | Product Module                       | Completed                          |
| Sprint 7  | CMS / Featured Collections           | Completed                          |
| Sprint 8  | Admin CMS                            | Completed                          |
| Sprint 9  | Admin Authentication & Authorization | Completed                          |
| Sprint 10 | Order System                         | Completed                          |
| Sprint 11 | Shipping Foundation                  | Completed                          |
| Sprint 12 | Payment Foundation                   | Completed                          |
| Sprint 13 | Smaregi Platform API Integration     | Phase A Complete / Sandbox Pending |
| Sprint 14 | Testing & Optimization               | Pending                            |
| Sprint 15 | AWS Production Release               | Pending                            |

---

# Current Sprint Goal

Sprint 13 — Smaregi Platform API Integration

Phase A is complete. Real Sandbox verification is pending credentials and the
configured Smaregi store ID.

---

# Customer Confirmed

- Physical Store
- Alcohol EC sales
- Smaregi POS
- Shared inventory
- Sagawa Shipping

## Waiting Confirmation

- EC Payment Provider
- Smaregi Sandbox credentials and Platform API permission
- Smaregi order synchronization decision
- Shipping Fee Rules
- Packaging Rules

---

# Technical Decisions

Frontend: Next.js App Router, TypeScript, Tailwind CSS

Backend: Route Handlers, Service Layer, Repository Pattern

Database: PostgreSQL (Neon), Prisma ORM

Validation: Zod

---

# Git Status

Branch: main

Latest Completed Sprint: Sprint 12

---

# Notes

Do not start a new sprint until the current sprint has been completed and verified.
All AI development agents must read `AGENTS.md`, `PROJECT_STATUS.md`, and `docs/` before starting work.
