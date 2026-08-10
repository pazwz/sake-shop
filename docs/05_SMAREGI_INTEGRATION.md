# Smaregi Platform API Integration

Version: 1.0

Last Update: 2026-08-10

## Authentication and environment

The integration uses the current Smaregi Platform API and an OAuth 2.0 App
Access Token with the client credentials grant. The token request uses HTTP
Basic authentication and an `application/x-www-form-urlencoded` body. Tokens
are cached server-side until shortly before expiry and are never returned to a
browser or persisted in SyncLog.

Environment variables:

- `SMAREGI_ENVIRONMENT`: `sandbox` or `production`; Sprint 13 defaults to
  `sandbox`.
- `SMAREGI_CONTRACT_ID`
- `SMAREGI_CLIENT_ID`
- `SMAREGI_CLIENT_SECRET`
- `SMAREGI_STORE_ID`

No value is hard-coded. The sandbox API base is
`https://api.smaregi.dev/{contract_id}/pos`; production is never selected
implicitly. Authentication follows the [official access-token guide](https://developers.smaregi.dev/platform-api-reference/start-guide/get-access-token/)
and [common Platform API specification](https://developers.smaregi.dev/platform-api-reference/common/).

## Scope

The read integration requests only:

- `pos.products:read`
- `pos.stock:read`
- `pos.stores:read`

Order Shipment scopes are not requested in Phase A. If the customer approves
order synchronization, the exact `order-shipment.orders:write` requirements
and payload mapping must be reviewed before enabling writes.

## Smaregi Client

`SmaregiClient` is server-only and owns token acquisition, token caching,
Authorization headers, pagination, a 10-second timeout, response validation,
error mapping, and retry behavior. Business services never call `fetch`
directly.

Retries are limited to three attempts and apply only to network/timeout errors,
HTTP 429, and HTTP 5xx. `Retry-After` is honored for 429 responses; otherwise
finite exponential backoff is used. HTTP 400, 401, 403, and mapping errors are
not retried. A rejected cached token is cleared so a later independent request
can acquire a new token.

## Store verification

Every product and inventory full sync reads the POS store list and requires an
exact match for `SMAREGI_STORE_ID`. A missing store fails the sync. The service
never chooses the first available store.

## Product and category sync

`SmaregiProductSyncService` performs a full read of categories followed by
products. Categories use `smaregiCategoryId`; products use
`smaregiProductId`. Repository upserts preserve those external identities and
do not compare names.

Category hierarchy is applied after all categories have been created or
updated. Products whose category is absent are counted as skipped. The initial
website slug is deterministic; later syncs do not update it.

Smaregi-owned product fields updated during sync are category, product code,
name, price, active state, and `lastSyncedAt`. Website-owned fields are not in
the update payload, including slug, description, tasting notes, EC images,
`isEcAvailable`, and CMS associations. New products start with
`isEcAvailable=false` so external data cannot automatically publish an EC
listing.

The current schema requires a tax-rate percentage while the POS product list
exposes tax treatment rather than a directly usable percentage. Phase A uses
the standard Japanese consumption tax rate mapping of 10 percent for newly
mirrored products. A future tax-settings integration must be reviewed before
supporting reduced or contract-specific tax configuration.

Official resources:

- [Category list](https://developers.smaregi.dev/platform-api-reference/apis/pos/operations/getcategories/)
- [Product list](https://developers.smaregi.dev/platform-api-reference/apis/pos/operations/getproducts/)

## Inventory sync

`SmaregiInventorySyncService` reads POS stock for the explicitly configured
store and upserts `InventoryMirror` by `(productId, smaregiStoreId)`. It updates
Smaregi quantity but never resets website `reservedQuantity`.

`availableQuantity = max(0, Smaregi quantity - Website reservedQuantity)`.

There is no Website-to-Smaregi inventory endpoint. The [official POS stock
endpoint](https://developers.smaregi.dev/platform-api-reference/apis/pos/operations/getstock/)
also notes that stock records appear only after stock has changed in Smaregi;
an absent row must not be interpreted as a website-owned stock value.

## Order sync

`SmaregiOrderService` enforces two existing idempotency gates:

1. An order with `smaregiOrderId` returns the existing result and is never
   created again.
2. Only an order with successful payment may proceed.

Actual order creation is intentionally disabled. Customer approval for order
sync and an exact official field mapping are both pending. The official
[Order Shipment API](https://developers.smaregi.dev/platform-api-reference/apis/order-shipment/)
is a separate API surface with separate scopes. No guessed payload is sent and
the Prisma schema is unchanged.

## SyncLog

Product, inventory, and attempted order syncs create SyncLog records with
system, entity type and ID, direction, action, status, retry count, start and
completion timestamps, and a sanitized error message when applicable.
Request/response payloads contain only non-secret sync metadata and summaries.
Client secrets and access tokens are never logged.

## Admin integration

`/admin/integrations/smaregi` shows environment, non-secret configuration
status, configured store ID, last product and inventory sync, result status,
and recent SyncLog rows.

- OWNER can view and manually start product or inventory full sync.
- MANAGER can view status.
- STAFF is redirected away.

Manual actions call protected website APIs. The browser never calls Smaregi:

`Browser → Website Admin/System API → Service → SmaregiClient`.

The protected endpoints are:

- `POST /api/v1/system/sync/products`
- `POST /api/v1/system/sync/inventory`
- `POST /api/v1/system/sync/orders`
- `GET /api/v1/admin/integrations/smaregi`

All input is validated with Zod before a business service is called.

## Webhook strategy

No Smaregi webhook endpoint is implemented in Phase A because the required
event subscription and payload have not been verified in a real Sandbox app.
Full/manual sync remains the supported mechanism. A webhook may be added only
from the official event contract after Sandbox access is available.

## Security

- Secrets and tokens remain server-side environment data.
- No Smaregi credential uses a `NEXT_PUBLIC_` prefix.
- Status responses expose booleans and configured store ID, never credentials.
- Logs store no secret-bearing request headers or token responses.
- Network calls have a timeout and finite retries.
- The integration requests minimum read scope only.
- Production is never selected automatically.

## Sandbox verification status

**Sandbox Integration Not Executed.**

The local environment has no Smaregi environment, contract ID, client ID,
client secret, or store ID configured. Phase A was verified with
`MockSmaregiClient` and automated tests. Mock verification is not external API
verification.
