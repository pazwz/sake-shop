# Sprint 10 — Order System

## Repository and service

- Added `OrderRepository` with order lookup, customer lookup, list, create, and order/payment/shipment status update methods. Order creation uses a Prisma transaction and nested `OrderItem` creation.
- Added `OrderService` for server-side pricing, inventory availability checks against `InventoryMirror`, address and item snapshots, age confirmation, unique `KURA-YYYYMMDD-XXXXXX` order numbers, and guarded status transitions.
- Checkout creates or updates the website-owned `Customer` record by email and always associates the new order with that customer. This remains compatible with the existing non-guest checkout flow and does not change the schema.

## API

- `POST /api/v1/orders` accepts only product IDs, quantities, customer/address data, age confirmation, shipping method, and demo payment method. It ignores client pricing and calculates all monetary values on the server.
- `GET /api/v1/orders/{orderNumber}` supplies the confirmation view.
- `GET /api/v1/admin/orders`, `GET /api/v1/admin/orders/{id}`, and `PATCH /api/v1/admin/orders/{id}` provide protected order administration. OWNER and MANAGER can change a permitted status; STAFF has read-only access.

## Checkout and admin

- `/checkout` now creates an order through the API and navigates to `/orders/[orderNumber]` on success.
- `/orders/[orderNumber]` displays only the public order number, order-item snapshots, totals, shipping address snapshot, and current status.
- Added `/admin/orders` and `/admin/orders/[id]` with order-number search, status filtering, detail display, and limited status changes. The old fake review/completion routes now redirect to checkout.

## Temporary development rule

- Shipping uses the single `DEVELOPMENT_SHIPPING_FEE` configuration value (`¥880`). This is explicitly temporary until the actual shipping rule is confirmed; no Sagawa rate is represented as production pricing.

## Verification

- Ran `pnpm prisma:seed` with an ephemeral local `ADMIN_SEED_PASSWORD`.
- Verified multiple-item order creation, server-side total recalculation with tampered client price fields, inventory conflict (`409`), age-confirmation validation (`422`), item/address snapshots, confirmation page, unauthenticated admin API (`401`), OWNER status update, invalid status transition (`422`), and STAFF write denial (`403`).
- `pnpm prisma generate`, `pnpm lint`, and `pnpm build` passed.

## Not included

- Real payment, refunds, Smaregi synchronization, Sagawa integration, shipment tracking, inventory writes/reservations, and guest checkout remain outside this sprint.
