-- Add customer read markers for order support messages.
ALTER TABLE "contact_inquiries" ADD COLUMN "customer_last_read_at" TIMESTAMP(3);

-- Store centrally managed, customer-visible announcements without recipient fan-out.
CREATE TYPE "SiteAnnouncementType" AS ENUM ('GENERAL', 'IMPORTANT', 'MAINTENANCE', 'BUSINESS_HOURS');

CREATE TABLE "site_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "SiteAnnouncementType" NOT NULL DEFAULT 'GENERAL',
    "published_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "site_announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_announcement_reads" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "announcement_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_announcement_reads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_announcements_is_published_published_at_idx" ON "site_announcements"("is_published", "published_at");
CREATE INDEX "site_announcements_expires_at_idx" ON "site_announcements"("expires_at");
CREATE UNIQUE INDEX "customer_announcement_reads_customer_id_announcement_id_key" ON "customer_announcement_reads"("customer_id", "announcement_id");
CREATE INDEX "customer_announcement_reads_customer_id_read_at_idx" ON "customer_announcement_reads"("customer_id", "read_at");

ALTER TABLE "customer_announcement_reads" ADD CONSTRAINT "customer_announcement_reads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_announcement_reads" ADD CONSTRAINT "customer_announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "site_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
