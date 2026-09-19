-- Additive newsletter campaign management. Existing transactional and
-- newsletter-contact outbox rows remain nullable and untouched.
ALTER TYPE "EmailOutboxStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';
ALTER TYPE "EmailTemplate" ADD VALUE IF NOT EXISTS 'NEWSLETTER_CAMPAIGN';
CREATE TYPE "NewsletterCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED');

CREATE TABLE "newsletter_campaigns" (
  "id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "preheader" TEXT,
  "headline" TEXT NOT NULL,
  "hero_image_url" TEXT,
  "hero_image_alt" TEXT,
  "body" TEXT NOT NULL,
  "cta_label" TEXT,
  "cta_url" TEXT,
  "status" "NewsletterCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduled_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "result_summary" TEXT,
  "created_by_admin_id" TEXT NOT NULL,
  "updated_by_admin_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "newsletter_campaigns_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "email_outbox"
  ADD COLUMN "newsletter_campaign_id" TEXT,
  ADD COLUMN "newsletter_subscription_id" TEXT;

CREATE INDEX "newsletter_campaigns_status_scheduled_at_idx"
  ON "newsletter_campaigns"("status", "scheduled_at");
CREATE INDEX "newsletter_campaigns_created_by_admin_id_idx"
  ON "newsletter_campaigns"("created_by_admin_id");
CREATE INDEX "email_outbox_newsletter_campaign_id_idx"
  ON "email_outbox"("newsletter_campaign_id");
CREATE INDEX "email_outbox_newsletter_subscription_id_idx"
  ON "email_outbox"("newsletter_subscription_id");

ALTER TABLE "newsletter_campaigns"
  ADD CONSTRAINT "newsletter_campaigns_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "newsletter_campaigns_updated_by_admin_id_fkey"
  FOREIGN KEY ("updated_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_outbox"
  ADD CONSTRAINT "email_outbox_newsletter_campaign_id_fkey"
  FOREIGN KEY ("newsletter_campaign_id") REFERENCES "newsletter_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "email_outbox_newsletter_subscription_id_fkey"
  FOREIGN KEY ("newsletter_subscription_id") REFERENCES "newsletter_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
