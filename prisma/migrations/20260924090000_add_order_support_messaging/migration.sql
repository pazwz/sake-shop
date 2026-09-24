-- One support thread is retained per order. NULL remains valid for legacy
-- general inquiries and PostgreSQL permits multiple NULL values in a unique index.
CREATE UNIQUE INDEX "contact_inquiries_order_id_key"
ON "contact_inquiries"("order_id");

ALTER TYPE "EmailTemplate" ADD VALUE 'ORDER_MESSAGE_NOTIFICATION';
