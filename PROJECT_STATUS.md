# PROJECT_STATUS

Project: Sake Shop EC Website

Status: 🟢 Active Development

Last Updated: 2026-08-09

---

# Current Milestone

Milestone 2

System Foundation

Current Sprint:

Sprint 7

CMS / Featured Collections

---

# Sprint Progress

| Sprint    | Name                         | Status         |
| --------- | ---------------------------- | -------------- |
| Sprint 1  | UI Demo                      | ✅ Completed   |
| Sprint 2  | Architecture & Documentation | ✅ Completed   |
| Sprint 3  | Project Infrastructure       | ✅ Completed   |
| Sprint 4  | Prisma Database Schema       | ✅ Completed   |
| Sprint 5  | PostgreSQL & Migration       | ✅ Completed   |
| Sprint 6  | Product Module               | ✅ Completed   |
| Sprint 7  | CMS / Featured Collections   | 🚧 In Progress |
| Sprint 8  | Admin Authentication         | ⏳ Pending     |
| Sprint 9  | Order System                 | ⏳ Pending     |
| Sprint 10 | Payment Integration          | ⏳ Pending     |
| Sprint 11 | Smaregi Platform API         | ⏳ Pending     |
| Sprint 12 | Shipping (Sagawa)            | ⏳ Pending     |
| Sprint 13 | Testing & Optimization       | ⏳ Pending     |
| Sprint 14 | AWS Production Release       | ⏳ Pending     |

---

# Completed

## Infrastructure

- [x] Next.js Project
- [x] TypeScript
- [x] TailwindCSS
- [x] Vercel Deployment
- [x] Prisma Installed
- [x] Project Architecture
- [x] Repository Pattern
- [x] Service Layer
- [x] Middleware Structure
- [x] Logger
- [x] Error Classes
- [x] Validation (Zod)

---

## Documentation

- [x] 01_REQUIREMENTS.md
- [x] 02_SYSTEM_ARCHITECTURE.md
- [x] 03_DATABASE.md
- [x] 04_API_SPEC.md
- [x] AGENTS.md

---

## Database

- [x] PostgreSQL (Neon)
- [x] Prisma Schema
- [x] Initial Migration
- [x] Seed
- [x] Prisma Studio
- [x] Database Health API
- [x] Models
- [x] Relations
- [x] Enums
- [x] Indexes
- [x] Constraints

---

# Current Sprint Goal

Sprint 7

Build CMS and Featured Collections.

Tasks:

- [ ] CMS API
- [ ] Featured Collections API
- [ ] Hero Management
- [ ] Seasonal Collections
- [ ] Shopkeeper Recommendations
- [ ] Collection Management

---

# Next Sprint

Sprint 8

Admin Authentication

Scope:

- Admin login
- Admin session
- Role authorization

---

# Customer Confirmed

## Business

- [x] Physical Store
- [x] 通信販売酒類小売業免許
- [x] Smaregi POS
- [x] Shared Inventory
- [x] Sagawa Shipping

---

## Waiting Confirmation

- [ ] EC Payment Provider
- [ ] Smaregi Platform API Permission
- [ ] Shipping Fee Rules
- [ ] Packaging Rules

---

# Technical Decisions

Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS

Backend

- Route Handlers
- Service Layer
- Repository Pattern

Database

- PostgreSQL (Neon)
- Prisma ORM

Validation

- Zod

Storage

Development

- Local Storage

Production

- AWS S3

Deployment

Development

- Vercel

Production

- AWS

---

# Important Rules

Source of Truth

Smaregi

- Product
- Category
- Price
- Inventory

Website owns

- Customer
- Orders
- Payments
- Shipments
- CMS
- Hero
- Featured Collections
- Admin
- Audit Logs
- Sync Logs

Website stores mirror data only.

---

# Blockers

Current

- None for Sprint 7.

---

# Git Status

Branch

main

Latest Completed Sprint

Sprint 6

Latest Commit

feat: implement product module

---

# Notes

Do not start a new Sprint until the current Sprint has been completed and verified.

Any architecture, database, or API changes must first be reflected in the documentation under `/docs`.

All AI development agents must read:

- AGENTS.md
- PROJECT_STATUS.md
- docs/

before starting any development task.
