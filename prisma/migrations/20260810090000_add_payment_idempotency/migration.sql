-- DropIndex
DROP INDEX "public"."payments_provider_payment_id_idx";

-- AlterTable
ALTER TABLE "public"."payments" ADD COLUMN "idempotency_key" TEXT;

-- CreateTable
CREATE TABLE "public"."payment_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "event_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_webhook_events_payment_id_idx" ON "public"."payment_webhook_events"("payment_id");
CREATE INDEX "payment_webhook_events_created_at_idx" ON "public"."payment_webhook_events"("created_at");
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_key" ON "public"."payment_webhook_events"("provider", "event_id");
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "public"."payments"("idempotency_key");
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "public"."payments"("provider", "provider_payment_id");

-- AddForeignKey
ALTER TABLE "public"."payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
