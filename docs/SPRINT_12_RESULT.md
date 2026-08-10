# Sprint 12 — Payment Foundation

## Database and migration

- Added nullable, unique `Payment.idempotencyKey` and provider-scoped unique
  `(provider, providerPaymentId)`.
- Added `PaymentWebhookEvent` with unique `(provider, eventId)` for durable
  webhook idempotency.
- Migration `20260810090000_add_payment_idempotency` was applied without
  changing existing Order, Payment, Shipment, AuditLog, or SyncLog data.

## Repository, service, and adapter

- Implemented `PaymentRepository` lookup, lifecycle update, webhook event, and
  transactional webhook processing methods.
- Implemented `PaymentService` for server-side amount lookup, idempotent create,
  legal status transitions, SHA-256 payload hashing, and Order payment linkage.
- Added a provider adapter interface and development-only `MockPaymentAdapter`.
  STERA, PAYPAY, and STRIPE all use the mock adapter in development; no real
  provider API is called.

## API and UI

- Added `POST /api/v1/payments/create` and `POST /api/v1/payments/webhook`.
- Checkout creates an Order, then a Payment, then completes the mock payment by
  calling the webhook API. The client never directly updates payment state.
- Order confirmation shows payment status. Admin order detail shows provider,
  payment status, amount, provider payment ID, paid time, and failed time; it
  has no manual paid control.

## Security and idempotency

- Amounts are derived from `Order.totalAmount`; client-supplied create amounts
  are ignored and webhook amounts are validated when present.
- No card number, CVV, PAN, provider secret, or token is accepted, persisted, or
  logged. Mock webhook signature verification is development-only; real adapter
  signature verification remains a dedicated interface boundary.
- Repeated create keys return one payment. Duplicate webhook events return
  success without a second Payment/Order transition. The database unique event
  constraint is the concurrent-delivery safeguard.

## Verification

- Verified create idempotency, server amount derivation, mock success webhook,
  Payment and Order success linkage, failed-payment behavior, duplicate webhook,
  concurrent duplicate webhook, invalid signature (`401`), invalid payment
  transition (`409`), already-paid order rejection (`409`), no admin manual paid
  path, confirmation payment status, webhook-event uniqueness, and provider
  payment-ID composite uniqueness.
- `pnpm prisma format`, `pnpm prisma validate`, `pnpm prisma generate`,
  `pnpm lint`, and `pnpm build` passed.

## Not included

- Real STERA, PAYPAY, or STRIPE integration, production webhook secrets,
  refunds UI, Smaregi, S3/AWS, and production payment credentials remain out of
  scope.
