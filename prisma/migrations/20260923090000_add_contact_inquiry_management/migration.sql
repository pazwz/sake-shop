-- Additive customer-support inbox. Existing contact notification rows remain untouched.
CREATE TYPE "ContactInquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'ANSWERED', 'CLOSED');
CREATE TYPE "ContactInquiryMessageDirection" AS ENUM ('CUSTOMER', 'ADMIN');

ALTER TYPE "EmailTemplate" ADD VALUE 'CONTACT_REPLY';

CREATE TABLE "contact_inquiries" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "status" "ContactInquiryStatus" NOT NULL DEFAULT 'NEW',
    "topic" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "customer_id" TEXT,
    "order_id" TEXT,
    "order_number" TEXT,
    "message" TEXT NOT NULL,
    "assigned_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "first_responded_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    CONSTRAINT "contact_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_inquiry_messages" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "direction" "ContactInquiryMessageDirection" NOT NULL,
    "author_admin_id" TEXT,
    "from_email" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "email_outbox_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_inquiry_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_inquiry_notes" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contact_inquiry_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_inquiries_public_id_key" ON "contact_inquiries"("public_id");
CREATE UNIQUE INDEX "contact_inquiries_submission_id_key" ON "contact_inquiries"("submission_id");
CREATE INDEX "contact_inquiries_status_created_at_idx" ON "contact_inquiries"("status", "created_at");
CREATE INDEX "contact_inquiries_assigned_admin_id_status_idx" ON "contact_inquiries"("assigned_admin_id", "status");
CREATE INDEX "contact_inquiries_email_idx" ON "contact_inquiries"("email");
CREATE INDEX "contact_inquiries_order_number_idx" ON "contact_inquiries"("order_number");
CREATE UNIQUE INDEX "contact_inquiry_messages_email_outbox_id_key" ON "contact_inquiry_messages"("email_outbox_id");
CREATE INDEX "contact_inquiry_messages_inquiry_id_created_at_idx" ON "contact_inquiry_messages"("inquiry_id", "created_at");
CREATE INDEX "contact_inquiry_notes_inquiry_id_created_at_idx" ON "contact_inquiry_notes"("inquiry_id", "created_at");

ALTER TABLE "contact_inquiries" ADD CONSTRAINT "contact_inquiries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_inquiries" ADD CONSTRAINT "contact_inquiries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_inquiries" ADD CONSTRAINT "contact_inquiries_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_inquiry_messages" ADD CONSTRAINT "contact_inquiry_messages_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "contact_inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contact_inquiry_messages" ADD CONSTRAINT "contact_inquiry_messages_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_inquiry_messages" ADD CONSTRAINT "contact_inquiry_messages_email_outbox_id_fkey" FOREIGN KEY ("email_outbox_id") REFERENCES "email_outbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contact_inquiry_notes" ADD CONSTRAINT "contact_inquiry_notes_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "contact_inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contact_inquiry_notes" ADD CONSTRAINT "contact_inquiry_notes_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
