-- Preserve all existing addresses and the unique index.
ALTER TABLE "admin_users" ALTER COLUMN "email" DROP NOT NULL;
