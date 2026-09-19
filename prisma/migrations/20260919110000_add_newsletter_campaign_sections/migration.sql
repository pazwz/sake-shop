-- Additive dynamic content sections for newsletter campaigns. Existing
-- campaigns, Hero fields, outbox rows and subscriptions remain untouched.
CREATE TABLE "newsletter_campaign_sections" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "image_url" TEXT,
  "image_alt" TEXT,
  "headline" TEXT,
  "body" TEXT,
  "cta_label" TEXT,
  "cta_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "newsletter_campaign_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "newsletter_campaign_sections_campaign_id_sort_order_idx"
  ON "newsletter_campaign_sections"("campaign_id", "sort_order");

ALTER TABLE "newsletter_campaign_sections"
  ADD CONSTRAINT "newsletter_campaign_sections_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "newsletter_campaigns"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
