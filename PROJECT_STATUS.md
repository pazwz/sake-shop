# PROJECT_STATUS

Project: Sake Shop EC Website

Status: Active Development

Last Updated: 2026-08-25

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

## Recent Maintenance

- Admin Collection and Editorial images now use short-lived presigned URLs for
  direct browser-to-S3 PUT uploads. The 10 MB limit and OWNER/MANAGER checks are
  enforced without sending image bodies through Vercel Functions.
- Production S3 CORS still requires an AWS-side rule for the Vercel origin;
  the current deployment credential cannot read or change Bucket CORS.
- Admin authentication now uses a unique login ID (`AdminUser.username`) while
  retaining email lookup as a transition fallback for historical accounts.
  Session cookies and OWNER/MANAGER/STAFF authorization rules are unchanged.
- Customer-facing branding has been formally updated from KURA to LINXAS. A
  shared HTML/CSS wordmark now keeps the Header, Footer, Admin entry, and
  loading states consistent while an official production logo asset remains
  pending from the customer.
- Official store details for リンクサス福岡 are centralized in `config/site.ts`:
  福岡県福岡市中央区大名1-1-7 gest22 1-B, 092-285-8022, and 11:00-20:00.
  The placeholder email, Tokyo address, dummy telephone number, and unavailable
  Xiaohongshu link have been removed from customer-facing views.
- The Footer now links only to the approved LINXAS Fukuoka Instagram account.
  The delayed loading state uses the local `wine-loading.json` Lottie asset,
  retains the 280 ms display threshold, and stops animation when reduced motion
  is requested.
- The approved minimum EditorialSection architecture is implemented. Editorial
  collections can now manage ordered article sections with a title, body,
  optional image, and optional featured product without changing the final
  FeaturedCollectionProduct selection semantics.
- Editorial detail pages render the article entirely through Server Components:
  alternating desktop compositions become a single mobile column, and legacy
  Editorials with no sections retain the existing description and product-grid
  fallback.
- Brand experience maintenance completed without changing the active sprint:
  Editorial CMS now supports one to three ordered entries, while OWNER/MANAGER
  write and STAFF read-only rules remain enforced at both page and API layers.
- Homepage Editorial presentation now adapts to one, two, or three magazine
  features. Editorial and Story detail pages use deliberately different visual
  hierarchies while preserving SSR and ordered collection products.
- Added a delayed branded loading illustration, reduced-motion-safe scroll
  reveals, restrained product/link motion, a repeated-action-safe cart toast,
  and branded empty states.
- Responsive art-directed images retain main/mobile fallback. The mobile header
  overlap and Next Image fill-parent warning were corrected.
- Footer social configuration is limited to the approved Instagram account.
- Public collection pages now provide server-rendered detail views for each
  seasonal feature, Shopkeeper, Gift, the current Editorial, and current Story
  entries. Homepage feature links lead to their content instead of the generic
  product list.
- `/collections/seasonal` provides the four-season feature index. Collection
  detail products come only from ordered FeaturedCollectionProduct relations;
  homepage product limits do not truncate detail pages.
- Homepage CMS simplification completed without starting a new sprint.
- `/admin/collections` now shows only the content that the homepage actually
  renders, organized by business area rather than FeaturedCollection records.
- Publication scheduling was removed from the operator UI. Homepage selection
  now uses direct `PUBLISHED` state and fixed content limits instead of future
  start/end times.
- Hero shows one current item, Editorial shows one to three, Story shows two,
  and Shopkeeper and Gift each manage one ordered list of at most three
  products.
- The development seed now defaults to one Hero, four seasonal slots, one
  Shopkeeper, one Gift, one Editorial, and two Story records. Exact old seed
  fixtures are archived without deleting data.
- Collection image upload distinguishes the main image from the optional
  smartphone composition override.
- Homepage SSR, Home API shape, FeaturedCollection schema, admin roles, and AWS
  media infrastructure remain unchanged.
- Orphan media cleanup remains pending; removing an image from a collection
  only removes the database URL reference.
