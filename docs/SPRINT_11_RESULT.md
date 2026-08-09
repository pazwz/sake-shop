# Sprint 11 — Shipping Foundation

## Shipment Repository and Service

- Added `ShipmentRepository` with shipment lookup, creation, carrier and tracking updates, status updates, shipped/delivered helpers, and transactional Order shipment-status synchronization.
- Added `ShipmentService` to enforce that only `READY_TO_SHIP` orders can receive their first shipment, validate tracking numbers, apply legal shipment transitions, and coordinate audit records.
- Status transitions are `PENDING → PREPARING → SHIPPED → DELIVERED`; cancellation and return transitions are constrained. Invalid transitions return `409`.

## Admin Shipping and API

- Added `PATCH /api/v1/admin/orders/{id}/shipment`, protected for OWNER and MANAGER. STAFF remains read-only.
- Extended the order-admin detail page with carrier, tracking number, ship date, shipment status, and a shipping action area.
- The existing order-detail read API supplies shipment data, so no undocumented read endpoint was added.

## Order linkage, tracking, and audit

- Shipment status changes update `Order.shipmentStatus` in the same Prisma transaction. Payment status is untouched.
- A trimmed, basic alphanumeric/hyphen tracking number is required before `SHIPPED`; real Sagawa validation and API calls are not implemented.
- Creating a shipment, updating carrier/tracking, preparing, marking shipped, and marking delivered write non-sensitive AuditLog records.
- Customer confirmation displays carrier, tracking number, ship date, and shipping status after shipment.

## Temporary shipping strategy

- Shipping fee remains the centralized development value from `config/order.ts`.
- `config/shipping.ts` introduces a temporary quote boundary and future-ready input shape for destination, package size, weight, and cool delivery. It does not encode real Sagawa contract rates.

## Verification

- Verified shipment creation, default SAGAWA carrier, tracking save, `SHIPPED` without tracking rejection (`422`), valid PENDING → PREPARING → SHIPPED → DELIVERED transitions, invalid transition (`409`), Order shipment-status synchronization, customer confirmation visibility, STAFF write denial (`403`), and all shipment audit actions.
- `pnpm prisma generate`, `pnpm lint`, and `pnpm build` passed.

## Not included

- Sagawa API integration, external tracking lookup, customer email notifications, real shipping-rate calculation, payment, Smaregi, S3, refunds, and shipment labels are out of scope.
