-- CreateTable
CREATE TABLE "public"."editorial_sections" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "product_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editorial_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editorial_sections_collection_id_display_order_idx" ON "public"."editorial_sections"("collection_id", "display_order");

-- CreateIndex
CREATE INDEX "editorial_sections_product_id_idx" ON "public"."editorial_sections"("product_id");

-- AddForeignKey
ALTER TABLE "public"."editorial_sections" ADD CONSTRAINT "editorial_sections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."featured_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."editorial_sections" ADD CONSTRAINT "editorial_sections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
