-- Separate from enum additions so PostgreSQL commits the new values first.
ALTER TABLE "admin_users" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
