# Sprint 13 — Smaregi Platform API Integration

## Status

Phase A complete: integration framework and Sandbox-ready implementation.

Phase B pending: **Sandbox Integration Not Executed** because no real Smaregi
Sandbox credentials or store ID are configured locally.

## Smaregi client and OAuth

- Added a server-only `SmaregiClient` using OAuth 2.0 App Access Token client
  credentials, HTTP Basic client authentication, token caching, expiry buffer,
  timeout, pagination, response validation, error mapping, and finite retry.
- Requested only `pos.products:read`, `pos.stock:read`, and
  `pos.stores:read`.
- Added environment selection and non-secret configuration status without
  exposing the client secret or access token.
- Added `MockSmaregiClient` for automated framework verification. Mock is not
  Sandbox.

## Product and inventory sync

- Added exact store verification; synchronization fails when the configured
  store ID does not exist.
- Added full category/product sync using `smaregiCategoryId` and
  `smaregiProductId` upserts.
- Product sync preserves slug, description, tasting notes, EC availability,
  images, and CMS associations on existing products.
- Added inventory mirror upsert by `(productId, smaregiStoreId)`. Smaregi
  quantity is mirrored while website reservations are preserved and available
  quantity is recalculated.
- No Website-to-Smaregi inventory write path exists.

## Order sync

- Added a protected `SmaregiOrderService` boundary.
- Existing `smaregiOrderId` provides the idempotent already-synced result, and
  successful payment is required before any future write.
- Actual Order Shipment API writes remain disabled because customer approval,
  required scope, and exact field mapping are pending. No schema change or
  guessed payload was introduced.

## Admin and APIs

- Added `/admin/integrations/smaregi` with safe configuration state, store ID,
  last product/inventory sync, and recent SyncLog records.
- OWNER can run manual product and inventory sync. MANAGER can view. STAFF is
  denied the integration page. All API endpoints enforce authorization in the
  service boundary and validate input with Zod.
- Added/implemented the documented product, inventory, and order system sync
  endpoints and a protected admin status endpoint.

## SyncLog, retry, and security

- SyncLog records contain lifecycle status, direction, action, retry count,
  timestamps, sanitized error, and non-secret summaries.
- Network timeout, HTTP 429, and HTTP 5xx are retried at most three times. 429
  honors `Retry-After`; 400/401/403 and mapping errors are not retried.
- Client secret and access token are not persisted, logged, or returned to the
  browser.

## Verification

- Automated Mock tests cover OAuth token caching and scope, 429/5xx retry, 401
  no-retry, category/product mapping, website-only field protection, inventory
  availability with reservations, and SyncLog success/failure paths.
- Verified all three system sync endpoints and the admin status endpoint return
  the standard `401 UNAUTHORIZED` response without an administrator session.
- `pnpm prisma generate` passed with Prisma 6.16.0.
- `pnpm test:smaregi` passed all 8 tests.
- `pnpm lint` passed.
- `pnpm build` passed with Next.js 16.3.0.

## Customer information still required

- Smaregi Sandbox contract ID, client ID, client secret, and exact store ID.
- Confirmation that the Sandbox app enables the three minimum read scopes.
- Confirmation whether website orders must be written to Smaregi.
- If order sync is approved, permission for the exact Order Shipment write
  scope and the required business mapping for store, payment, tax, shipping,
  cancellation, and fulfillment.
- Required polling frequency and whether supported webhook events will be
  enabled for the app.
