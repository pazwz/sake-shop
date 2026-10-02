ALTER TABLE "contact_inquiry_messages" ADD COLUMN "author_customer_id" TEXT;

CREATE TABLE "admin_inquiry_message_reads" (
    "admin_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_inquiry_message_reads_pkey" PRIMARY KEY ("admin_id", "message_id")
);

CREATE INDEX "admin_inquiry_message_reads_message_id_idx" ON "admin_inquiry_message_reads"("message_id");
CREATE INDEX "contact_inquiry_messages_direction_inquiry_id_created_at_idx" ON "contact_inquiry_messages"("direction", "inquiry_id", "created_at");

ALTER TABLE "contact_inquiry_messages" ADD CONSTRAINT "contact_inquiry_messages_author_customer_id_fkey" FOREIGN KEY ("author_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_inquiry_message_reads" ADD CONSTRAINT "admin_inquiry_message_reads_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_inquiry_message_reads" ADD CONSTRAINT "admin_inquiry_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "contact_inquiry_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
