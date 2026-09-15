CREATE TYPE "public"."SmaregiProductExclusionReason" AS ENUM ('OFFLINE_ONLY');

CREATE TYPE "public"."SyncLogItemType" AS ENUM (
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'INVENTORY_CREATED',
  'INVENTORY_UPDATED',
  'INVENTORY_ZEROED',
  'PRODUCT_DELETED',
  'PRODUCT_RETIRED',
  'PRODUCT_SUPPRESSED',
  'TAX_DEFERRED',
  'QUARANTINED',
  'ORPHAN_INVENTORY',
  'NEGATIVE_STOCK'
);

CREATE TABLE "public"."smaregi_product_exclusions" (
  "id" TEXT NOT NULL,
  "smaregi_product_id" TEXT NOT NULL,
  "product_code" TEXT,
  "product_name_snapshot" TEXT,
  "reason" "public"."SmaregiProductExclusionReason" NOT NULL,
  "created_by_id" TEXT,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "smaregi_product_exclusions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "smaregi_product_exclusions_smaregi_product_id_key"
  ON "public"."smaregi_product_exclusions"("smaregi_product_id");
CREATE INDEX "smaregi_product_exclusions_revoked_at_idx"
  ON "public"."smaregi_product_exclusions"("revoked_at");

ALTER TABLE "public"."smaregi_product_exclusions"
  ADD CONSTRAINT "smaregi_product_exclusions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "public"."admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "public"."sync_log_items" (
  "id" TEXT NOT NULL,
  "sync_log_id" TEXT NOT NULL,
  "type" "public"."SyncLogItemType" NOT NULL,
  "smaregi_product_id" TEXT,
  "product_code" TEXT,
  "product_name" TEXT,
  "store_id" TEXT,
  "store_name" TEXT,
  "reason" TEXT,
  "changes" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_log_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sync_log_items_sync_log_id_idx" ON "public"."sync_log_items"("sync_log_id");
CREATE INDEX "sync_log_items_type_idx" ON "public"."sync_log_items"("type");
CREATE INDEX "sync_log_items_created_at_idx" ON "public"."sync_log_items"("created_at");

ALTER TABLE "public"."sync_log_items"
  ADD CONSTRAINT "sync_log_items_sync_log_id_fkey"
  FOREIGN KEY ("sync_log_id") REFERENCES "public"."sync_logs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
