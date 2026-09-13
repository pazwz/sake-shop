ALTER TABLE "customers" ADD COLUMN "password_hash" TEXT;

CREATE TABLE "customer_sessions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_sessions_token_hash_key" ON "customer_sessions"("token_hash");
CREATE INDEX "customer_sessions_customer_id_idx" ON "customer_sessions"("customer_id");
CREATE INDEX "customer_sessions_expires_at_idx" ON "customer_sessions"("expires_at");

ALTER TABLE "customer_sessions"
ADD CONSTRAINT "customer_sessions_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
