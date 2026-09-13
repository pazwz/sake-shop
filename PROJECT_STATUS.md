# PROJECT_STATUS

Project: LINXAS Sake Shop EC Website

Status: Production catalog and operations foundation active; real commerce launch blockers remain

Last Updated: 2026-09-13

---

# Executive Summary

The project has progressed beyond the original sprint plan. The public catalog,
LINXAS content management, private media delivery, Admin authentication, and the
Smaregi production-to-Neon read-only mirror are implemented and deployed.

The site is **not yet ready to accept real customer orders**. Customer accounts
are browser-local demo data, payment always uses a Mock adapter, shipping uses a
temporary fixed rule, reservation expiry/release is not connected to the full
order lifecycle, and required legal/support flows are incomplete.

Do not use the old Sprint 13 / Sandbox Pending milestone as the current state.
Future work should be prioritized by production risk rather than by continuing
the historical sprint numbering.

---

# Current Work State

- Production catalog, CMS, media, Admin, and Smaregi inventory-mirror operations
  are active.
- Real customer checkout is intentionally classified as not production-ready.
- Current planning focus is the P0 production-commerce boundary listed below;
  no new feature sprint is active during this audit.

---

# Source of Truth

- Smaregi production is authoritative for Product identity, Category, name,
  product code, price, active state, and physical stock.
- Neon stores the validated Smaregi mirror plus LINXAS-owned commerce/content
  data.
- LINXAS is authoritative for slug, EC publication, description, tasting notes,
  producer, origin, volume, alcohol percentage, ProductImage, box binding,
  Collections, Editorial, Story, Customers, Orders, Payments, Shipments, and
  InventoryReservation.
- Current implementation status is established from Git code, Prisma schema,
  deployed migrations, current tests, and safe Production read-only checks.
- `docs/01_REQUIREMENTS.md` through `docs/04_API_SPEC.md` remain the design source
  of truth. Historical sprint result files document history, not current status.

---

# Current Architecture

```text
Customer / Admin browser
        |
        v
Next.js App Router on Vercel (Node.js Functions: sin1)
        |
        +--> Route -> Service -> Repository -> Prisma -> Neon PostgreSQL
        |
        +--> Presign API -> private S3 upload -> CloudFront delivery

AWS EventBridge Scheduler (every 15 minutes)
        |
        v
AWS Lambda trigger
        |
        v
Protected Vercel internal sync endpoint
        |
        v
Smaregi production read APIs -> validated atomic mirror -> Neon
```

Smaregi remains the source of truth for product/category/price/physical stock.
LINXAS remains the source of truth for EC publication, copy, images, Collections,
Editorial, Story, customer/order/payment/shipment records, and reservations.

---

# Production Snapshot (Read Only)

Snapshot checked on 2026-09-13 using the configured Production Neon connection:

| Entity | Current count |
| --- | ---: |
| Category (all) | 22 |
| Smaregi-linked Category | 14 |
| Product (all) | 463 |
| Active Product | 463 |
| Public Product | 415 |
| ProductImage | 424 |
| InventoryMirror | 1,825 |
| InventoryReservation | 0 |
| Customer | 8 |
| Order | 8 |
| Payment | 6 |
| Shipment | 1 |
| FeaturedCollection | 19 |
| Published FeaturedCollection | 11 |
| FeaturedCollectionProduct relation | 53 |
| EditorialSection | 3 |
| AdminUser | 6 |
| SyncLog | 892 |

The latest Smaregi production snapshot reported:

- outcome: `SUCCESS_WITH_WARNINGS`
- trigger: `CRON`
- source Products: 446
- unchanged normal Products: 439
- approved deferred box Products: 6
- quarantined Products: 1
- source Stock rows: 797
- unchanged InventoryMirror plan rows: 1,756
- known orphan Stock: 11
- new orphan Stock: 0
- negative Stock warnings: 5
- fatal error: none

These source-snapshot figures and total Neon row counts measure different
things. Do not infer a deletion or failed sync by comparing them directly.

---

# Completed and Operational

## Platform and Infrastructure

- Next.js App Router, TypeScript, Tailwind CSS, Prisma, and Neon PostgreSQL.
- Vercel Production deployment and alias are reachable.
- Node.js Function region is configured as Singapore (`sin1`).
- Prisma Client is shared through the project singleton.
- Database health endpoint is operational.
- S3 bucket remains private with Block Public Access enabled.
- Browser-to-S3 presigned PUT upload is enabled for images up to 10 MB.
- S3 CORS permits the Production Vercel origin for PUT, GET, and HEAD.
- CloudFront and Unsplash domains are configured for Next Image.

## Smaregi Production Integration

- Customer production contract and OAuth client-credentials access are active.
- Production Stores, Categories, Products, Stock, consumption tax rates, and
  reduced tax rates are read through official read-only APIs.
- Access tokens are cached in process memory with expiry handling.
- Source requests use pagination, timeouts, retry handling, and safe logging.
- Four approved inventory locations are handled independently: stores 1, 2, 3,
  and 6.
- Tax resolution is fail-closed; no blanket fallback is used.
- Six package-only Products with unresolved category tax remain explicitly
  deferred.
- Known orphan Stock is isolated and warning-reported.
- Negative normal stock is quarantined; projected EC availability never becomes
  negative.
- Product/category/inventory writes use one approved atomic transaction after
  all Smaregi GET requests and validation complete.
- Existing LINXAS-owned Product fields are protected by an update allowlist.
- New Smaregi Products default to `isEcAvailable=false`.
- PostgreSQL advisory locking prevents concurrent production sync execution.
- Admin manual sync and the protected internal automatic-sync route are present.
- EventBridge Scheduler is enabled at `rate(15 minutes)` and invokes the Lambda
  trigger. Retry remains one attempt with a 900-second maximum event age.
- SyncLog records success, warnings, failures, counts, and safe anomaly summaries.
- No Smaregi write API is used by the production product/inventory sync.

## Product and Public Catalog

- Public visibility consistently requires active, EC-enabled, standalone
  Products.
- Package-only and service-only identities are excluded from public listings,
  search, recommendations, Collections, and direct detail access.
- Product listing supports query, category/group, sorting, pagination, and
  24/48/96 page sizes.
- Product detail is server-rendered and includes approved-store availability,
  optional compatible box selection, and related Products.
- Header and home category navigation use the shared public navigation config.
- Shared ProductCard is used across catalog, search, Collections, home sections,
  and related products.
- Admin product listing, filtering, image status, editing, publication validation,
  ordered images, compatible box selection, and signed preview are implemented.
- Smaregi-owned fields are read-only in Admin; OWNER/MANAGER can manage LINXAS
  fields and STAFF is read-only.
- Product identity matching, enrichment safeguards, and image normalization
  tooling have focused automated tests.

## Homepage and Collection CMS

- Homepage initial content is fetched server-side through Service/Repository.
- Hero, Seasonal, Shopkeeper, Gift, Editorial, and Story are driven by
  FeaturedCollection data.
- Homepage product flattening is deduplicated by Product ID where applicable.
- Collection detail pages are server-rendered and preserve configured product
  order without the homepage item limits.
- `/collections/seasonal` is the four-season landing page.
- Missing/unpublished/out-of-window Collections return 404.
- Story renders all currently published records in `displayOrder`; it has no
  fixed two-item cap.
- Editorial supports one to three published entries and ordered EditorialSection
  content with optional image and featured Product.
- Legacy Editorial content falls back to description plus collection products.
- Admin Collection create/edit/archive/delete, product selection/order, image
  upload/removal, and EditorialSection editing are implemented.
- OWNER/MANAGER write and STAFF read-only rules are enforced at page and API
  layers.

## Admin Authentication and Operations

- Admin login supports username with email fallback for historical accounts.
- Password hashes use bcrypt; no plaintext Admin password is stored.
- Signed HTTP-only session cookies and active-user checks are implemented.
- OWNER, MANAGER, and STAFF role boundaries exist in API handlers as well as UI.
- Admin order list/detail, order-status update, shipment creation/update,
  tracking number, and shipment audit records are implemented.

## Order and Inventory Foundation

- Order creation revalidates Product identity, publication, price, tax, stock,
  and optional box relationship on the server.
- Product rows are locked in stable ID order to protect concurrent orders.
- Customer upsert, Order, OrderItem, and InventoryReservation creation occur in
  one transaction.
- Base bottle and optional box are separate OrderItems and reservations.
- Four-store physical inventory is projected without writing back to Smaregi.
- `requiresTransfer` marks lines that need manual movement to store 1.
- Reservation status supports ACTIVE, RELEASED, CONSUMED, and EXPIRED, and
  release/consume repository operations are idempotent.
- Payment records, webhook event idempotency, payment transitions, Shipment
  records, and audit logs have database/repository foundations.

## Brand, Media, and Compliance Display

- LINXAS branding and current Fukuoka store information are centralized.
- The legal notice `20歳未満の者の飲酒は法律で禁止されています。` appears
  on product lists, product detail, checkout age confirmation, cart, and Footer.
- `通信販売酒類小売業免許取得済` appears in Footer and store information.
- Image components guard empty URLs and use CloudFront-compatible Next Image
  configuration.
- Instagram links to the configured official account.

---

# Implemented but Needs Improvement

## Public Frontend

- `/products` and `/search` still perform their initial result request from a
  Client Component; they do not have homepage-style SSR content.
- Homepage and Collection routes are force-dynamic and currently do not use a
  deliberate content-cache policy.
- Product detail fetches the Product and then related Products sequentially.
- Recently Viewed still reads the original local mock Product catalog and does
  not reliably represent current database Products.
- Locale selection changes UI state, but most content is not truly localized.

## Admin and CMS

- Login throttling is process-memory-only and is not reliable across multiple
  serverless instances.
- Admin order list uses client-side loading without a full error/retry state.
- Admin user management, newsletter management, and audit-log browsing described
  in the API design are not implemented as routes/pages.
- Removing/replacing Product or Collection images removes database references but
  does not clean the old S3 object.

## Media

- The browser and presign API validate the declared 10 MB size, but S3 does not
  independently verify image content or guarantee that the uploaded bytes match
  the declared file size/type.
- No automated orphan-media cleanup, derivative pipeline, crop/position editor,
  or retained-original asset model is implemented.

## Documentation and Configuration

- `docs/01_REQUIREMENTS.md` through `docs/04_API_SPEC.md` describe most current
  product, collection, order, and Smaregi boundaries, but their header dates are
  stale.
- `docs/04_API_SPEC.md` includes planned Admin newsletter/user/audit endpoints
  that do not exist yet and should be marked explicitly as planned.
- `docs/05_SMAREGI_INTEGRATION.md`, `docs/TODO.md`, and historical sprint result
  documents preserve old milestone history and are not current status sources.
- `.env.example` contains planned payment-provider variables that are not used by
  the current Mock-only runtime; the runtime environment contract should be
  documented more precisely before release.

---

# Remaining Work — Not Implemented / Not Production Ready

## Customer Identity and Account

- Registration/login are browser-local demo flows and store demo passwords in
  localStorage. They are not production authentication.
- My Page/order history uses local demo storage rather than the Customer and
  Order tables.
- No password reset, email verification, authenticated Customer session, address
  book, or account deletion flow exists.

## Real Checkout and Payment

- Production Checkout safety gate is active. Until a real Payment Adapter is
  implemented, Production rejects new consumer Order/OrderItem/Payment/
  InventoryReservation writes with `CHECKOUT_DISABLED` before persistence.
- Cart remains usable and Checkout displays a preparation state. Local
  development defaults to Mock checkout; Preview requires explicit `mock` mode.
- Production missing/invalid mode, explicit `disabled`, accidental `mock`, and
  currently unavailable `live` mode all fail closed without Mock fallback.
- In enabled local/Preview Mock mode, all payment-provider choices currently
  resolve to `MockPaymentAdapter`, and Checkout calls the Mock webhook itself.
- Payment create/webhook routes are not ready for a production provider contract.
- A real provider redirect/3DS flow, signature verification, reconciliation,
  refunds, and operational failure handling are not implemented.

## Reservation and Order Lifecycle

- Consumer Order detail safety gate is complete: without a trusted server-side
  Customer Session, the public Order API rejects access before querying Order
  data, and public detail pages do not load or render Order PII.
- Checkout confirmation remains available as a minimal receipt containing only
  the newly created order number; it does not refetch Order data.
- Full Customer ownership authorization is not complete. The temporary gate must
  be replaced by a trusted Customer Session plus ownership-scoped query and a
  minimized Customer Order DTO.
- New reservations have `expiresAt=null`; automatic expiry is not implemented.
- Payment failure/timeout and order cancellation are not wired to release ACTIVE
  reservations.
- Payment success/fulfillment is not wired to consume reservations.
- Order write-back to Smaregi is deliberately blocked pending customer approval
  and official field mapping.

## Shipping and Fulfillment

- Shipping currently uses a temporary fixed fee and `development-standard`.
- No confirmed Sagawa zone/size/weight/cool-delivery tariff table exists.
- Label creation, carrier API integration, delivery-time selection, and customer
  shipment notifications are not implemented.

## Legal, Support, and Marketing Operations

- Dedicated Terms, Privacy Policy, Specified Commercial Transactions, shipping,
  returns/cancellation, and alcohol-sales policy pages are absent.
- Contact form is a demo and sends no message.
- Newsletter form is a demo and persists/sends nothing.
- No transactional email exists for registration, order confirmation, payment,
  cancellation, shipment, or password reset.
- Xiaohongshu is not linked because no approved official URL is configured.

## Testing and Observability

- There is no browser end-to-end suite for customer checkout, Admin workflows,
  authorization boundaries, or responsive navigation.
- There is no real payment-provider integration test or shipping integration test.
- There is no general `pnpm test` script; coverage is split between Product and
  Smaregi suites.
- Production sync logging exists, but alerting/escalation for failed scheduled
  runs is not represented in this repository.

---

# External Decisions and Inputs Required

- Production online payment provider contract, credentials, callback domains,
  settlement/refund rules, and PCI/3DS operating model.
- Final Sagawa shipping tariff rules, cool-delivery rules, package sizes, remote
  island handling, free-shipping policy, and cancellation/return policy.
- Customer-approved legal copy for Terms, Privacy, Specified Commercial
  Transactions, alcohol sales, returns, and data retention.
- Decision on Customer authentication provider and account/session policy.
- Decision and official field mapping for any future LINXAS-to-Smaregi order
  write-back.
- Newsletter/contact delivery provider and consent/retention requirements.
- Official production logo asset and any additional approved social URLs.

---

# Recommended Priority

## P0 — Required Before Accepting Real Orders

1. Keep the completed Production Checkout safety gate enabled until a reviewed
   real Payment Adapter is ready.
2. Implement server-side Customer authentication and ownership authorization;
   replace the temporary fail-closed Order detail gate and remove browser-stored
   passwords.
3. Integrate the approved production payment provider and webhook flow.
4. Finalize shipping fees/rules and checkout totals.
5. Connect reservation release/consume/expiry to payment and order transitions.
6. Publish the required legal, privacy, transaction, shipping, and return pages.
7. Add end-to-end tests for purchase, stock contention, payment failure,
   cancellation, authorization, and shipment transitions.

## P1 — Operational Readiness

- Implement transactional email and working contact/newsletter delivery.
- Add distributed Admin login throttling and security-event monitoring.
- Add Admin customer/payment/audit views required by operations.
- Add scheduled-sync alerting and an operator runbook.
- Add safe S3 orphan cleanup and stronger uploaded-file verification.
- Align API/Smaregi/TODO documentation labels with implemented versus planned
  state.

## P2 — Quality and Optimization

- Move catalog/search initial content to SSR or an intentional caching strategy.
- Parallelize safe independent Product detail reads and apply measured cache TTLs.
- Replace Recently Viewed mock data with current Product identities.
- Complete localization or remove the non-functional locale choices.
- Add image crop/position/derivative tooling while retaining source assets.
- Continue accessibility, responsive, performance, and browser regression testing.

---

# Recommended Next Task

The next task should be a **production checkout safety gate and customer/order
authorization design review**. It should define how Mock checkout is disabled in
Production, how Customer sessions own Orders, and how reservation lifecycle hooks
will connect to payment outcomes. This is the smallest task that removes the
highest current production risk without changing Smaregi product/inventory sync.

Do not start a new feature sprint until that boundary is approved.

---

# Audit Verification

Current-state audit completed on 2026-09-13:

- Product tests: 137 passed, 0 failed.
- Smaregi tests: 58 passed, 0 failed.
- TypeScript: passed.
- ESLint: passed with zero warnings.
- Production build: passed (Next.js 16.3.0).
- Prisma schema validation: passed.
- Prisma migration status: 7 migrations, database up to date.
- Git whitespace check: passed.
- Production read-only smoke checks: home, products, seasonal collection,
  Admin entry, and database health returned HTTP 200 (Admin followed its normal
  login redirect).
- Production response path confirmed Vercel `sin1`.
- No Product, inventory, order, reservation, Smaregi, AWS, or Production
  business data was modified by the audit.
