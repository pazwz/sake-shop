# Sprint 4 — Database Foundation

## Prisma models

Category, Product, ProductImage, InventoryMirror, Customer, CustomerAddress,
Order, OrderItem, Payment, Shipment, FeaturedCollection,
FeaturedCollectionProduct, AdminUser, AuditLog, and SyncLog are defined in
`prisma/schema.prisma`.

## Database conventions

- Product, category, price, and inventory records are Smaregi mirror data.
- Monetary fields use PostgreSQL `Decimal`; inventory quantities use `Int`.
- Product images and shipping labels are URL fields only.
- Historical records use restrictive relations; no history relation cascades from
  customers, products, or administrators.

## Migration status

Migration skipped because `DATABASE_URL` is not configured.

## Open items

- A PostgreSQL connection is required before the initial `init_database`
  migration can be created.
- No production seed data is defined in this sprint.
