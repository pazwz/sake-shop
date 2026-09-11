-- A normal EC product may reference one internal Smaregi package-only SKU.
ALTER TABLE "products"
ADD COLUMN "box_product_id" TEXT;

CREATE UNIQUE INDEX "products_box_product_id_key"
ON "products"("box_product_id");

ALTER TABLE "products"
ADD CONSTRAINT "products_box_product_id_fkey"
FOREIGN KEY ("box_product_id") REFERENCES "products"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- The package OrderItem remains a separately priced and reserved child line.
ALTER TABLE "order_items"
ADD COLUMN "parent_order_item_id" TEXT;

CREATE UNIQUE INDEX "order_items_parent_order_item_id_key"
ON "order_items"("parent_order_item_id");

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_parent_order_item_id_fkey"
FOREIGN KEY ("parent_order_item_id") REFERENCES "order_items"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
