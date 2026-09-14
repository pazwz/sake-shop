CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');
CREATE TYPE "EmailTemplate" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'WELCOME', 'ORDER_RECEIVED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'ORDER_CANCELLED', 'SHIPMENT_SENT', 'NEWSLETTER_CONTACT_SYNC');
CREATE TYPE "NewsletterStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED', 'SUPPRESSED');

ALTER TABLE "customers" ADD COLUMN "email_verified_at" TIMESTAMP(3);

CREATE TABLE "email_verification_tokens" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_outbox" (
  "id" TEXT NOT NULL,
  "event_key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "template" "EmailTemplate" NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "provider" TEXT,
  "provider_message_id" TEXT,
  "delivery_status" TEXT,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_webhook_events" (
  "id" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "newsletter_subscriptions" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" "NewsletterStatus" NOT NULL DEFAULT 'SUBSCRIBED',
  "consent_at" TIMESTAMP(3) NOT NULL,
  "unsubscribed_at" TIMESTAMP(3),
  "source" TEXT NOT NULL,
  "resend_contact_id" TEXT,
  "unsubscribe_token_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_customer_id_expires_at_idx" ON "email_verification_tokens"("customer_id", "expires_at");
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_customer_id_expires_at_idx" ON "password_reset_tokens"("customer_id", "expires_at");
CREATE UNIQUE INDEX "email_outbox_event_key_key" ON "email_outbox"("event_key");
CREATE UNIQUE INDEX "email_outbox_provider_message_id_key" ON "email_outbox"("provider_message_id");
CREATE INDEX "email_outbox_status_next_attempt_at_idx" ON "email_outbox"("status", "next_attempt_at");
CREATE UNIQUE INDEX "email_webhook_events_provider_event_id_key" ON "email_webhook_events"("provider_event_id");
CREATE INDEX "email_webhook_events_processed_at_idx" ON "email_webhook_events"("processed_at");
CREATE UNIQUE INDEX "newsletter_subscriptions_email_key" ON "newsletter_subscriptions"("email");
CREATE UNIQUE INDEX "newsletter_subscriptions_unsubscribe_token_hash_key" ON "newsletter_subscriptions"("unsubscribe_token_hash");
CREATE INDEX "newsletter_subscriptions_status_idx" ON "newsletter_subscriptions"("status");

ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
