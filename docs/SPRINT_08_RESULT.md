# Sprint 8 — Admin CMS

## Admin pages

- Added `/admin`, `/admin/collections`, `/admin/collections/new`, and
  `/admin/collections/[id]`.
- The demo admin area manages only website-owned featured collection content.
  It does not modify product master data, price, inventory, or Smaregi fields.

## API and architecture

- Added `GET` and `POST /api/v1/admin/collections`.
- Added `PATCH` and `DELETE /api/v1/admin/collections/{id}`.
- Added `PATCH /api/v1/admin/collections/{id}/products/order`.
- All endpoints use Zod request validation and follow Route → Service →
  Repository → Prisma. Responses use the existing API response format.

## CMS features

- Collections can be listed, created, edited, published, unpublished by
  switching status, archived, and reordered through `displayOrder`.
- The editable fields are type, season, title, subtitle, description, desktop
  and mobile image URLs, status, publish dates, and display order.
- Deletion is intentionally limited to draft or archived collections. Published
  content must be unpublished first to avoid removing live historical content.

## Product associations

- The form loads read-only product choices from the existing product API.
- Editors can add and remove featured products, and control their order with
  up/down controls. The persisted order is stored in
  `FeaturedCollectionProduct.displayOrder`.

## Verification

- Manual API verification passed: create, edit, publish, featured product
  ordering, homepage read, unpublish, and delete.
- `pnpm prisma generate` passed.
- `pnpm lint` passed.
- `pnpm build` passed.

## Not included

- Real admin authentication, orders, payment, Smaregi, shipping, image upload,
  S3, and AWS remain outside Sprint 8 scope.
