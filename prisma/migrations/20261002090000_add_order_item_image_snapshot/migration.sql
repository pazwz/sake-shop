-- Preserve the product image selected when the order was placed.
-- Legacy order items remain NULL and use the existing product-image fallback.
ALTER TABLE "order_items" ADD COLUMN "product_image_url_snapshot" TEXT;
