# PROJECT_STATUS

Project: Sake Shop EC Website

Status: 🟢 Active Development

Last Updated: 2026-08-09

---

# Current Milestone

Milestone 2

System Foundation

Current Sprint:

Sprint 6

Product Module

---

# Sprint Progress

| Sprint    | Name                         | Status         |
| --------- | ---------------------------- | -------------- |
| Sprint 1  | UI Demo                      | ✅ Completed   |
| Sprint 2  | Architecture & Documentation | ✅ Completed   |
| Sprint 3  | Project Infrastructure       | ✅ Completed   |
| Sprint 4  | Prisma Database Schema       | ✅ Completed   |
| Sprint 5  | PostgreSQL & Migration       | ✅ Completed   |
| Sprint 6  | Product Module               | 🚧 In Progress |
| Sprint 7  | CMS / Featured Collections   | ⏳ Pending     |
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

- [x] Prisma Schema
- [x] Models
- [x] Relations
- [x] Enums
- [x] Indexes
- [x] Constraints

---

# Current Sprint Goal

Sprint 6

Build the Product Module.

Tasks:

- [ ] Product API
- [ ] Category API
- [ ] Product Detail
- [ ] Product Search
- [ ] Product Image
- [ ] Inventory Mirror Read

---

# Next Sprint

Sprint 7

CMS / Featured Collections

Scope:

- CMS API
- Featured Collections API
- Featured Collection Management

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

Backend

- Route Handler
- Service Layer
- Repository Pattern

Database

- PostgreSQL
- Prisma ORM

Storage

- AWS S3 (Production)

Deployment

Development:

- Vercel

Production:

- AWS

---

# Important Rules

Product / Category / Price / Inventory

Source of Truth:

Smaregi

Website stores mirror data only.

Website owns:

- Customer
- Orders
- Payments
- Shipments
- CMS
- Hero
- Featured Collections
- Admin

---

# Blockers

Current:

- None for Sprint 5.

---

# Git Status

Main Branch

Latest Completed Sprint:

Sprint 5

Latest Commit:

feat: initialize database

---

# Notes

Do not start a new Sprint until the current Sprint is completed and verified.

All architecture changes must first update the documentation under /docs.
