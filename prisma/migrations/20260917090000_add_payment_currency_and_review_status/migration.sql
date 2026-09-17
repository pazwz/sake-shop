-- Persist the order currency with each payment attempt and retain a fail-closed
-- state for a provider success that arrives after its inventory hold expired.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_REVIEW';

ALTER TABLE "payments"
ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'JPY';
