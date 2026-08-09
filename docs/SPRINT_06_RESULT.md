# Sprint 6 — Product Module

## Repository

- `ProductRepository` provides active product listing, identifier and slug lookup,
  category filtering, search, sorting, and pagination queries.
- `CategoryRepository` provides active category-tree reads.
- `InventoryMirrorRepository` provides read-only inventory mirror lookups.
- All Prisma access remains inside repositories.

## Service and API

- `ProductService`, `CategoryService`, and `InventoryService` implement the
  read path above the repository layer.
- `GET /api/v1/products` supports `page`, `limit`, `category`,
  `subcategory`, `keyword`, `season`, and `sort`.
- `GET /api/v1/products/{id-or-slug}`, `GET /api/v1/categories`, and
  `GET /api/v1/search` use the shared response and AppError conventions.
- Query parameters use Zod validation. Inventory is read from
  `InventoryMirror` only; no inventory mutation endpoint exists.

## Development seed

- Added nine development-only mirror products across 日本酒, ウイスキー, and
  ワイン, with ProductImage and InventoryMirror records.
- Development data is identified by `dev-` Smaregi IDs and product codes.
- The seed is idempotent and does not copy the existing UI Mock Data.

## Frontend migration

- `/products` reads the product and category APIs, including keyword,
  category, and sorting controls.
- `/products/[slug]` reads the product detail API and its inventory mirror.
- `/search` reads the search API.
- Empty states are shown for zero results; no Mock Data fallback is used.
- Homepage seasonal and editorial recommendations remain unchanged for Sprint 7.

## Verification

- `pnpm prisma generate` passed.
- Product list, detail, category, and search APIs returned successful HTTP 200
  responses against Neon PostgreSQL.
- Browser verification confirmed the product list (9 products), 嘉之助 detail,
  inventory display, and keyword search result.
- `pnpm lint` passed.
- `pnpm build` passed.

## Not included

- Smaregi Platform API integration and real synchronization.
- Inventory writes, payment, and order implementation.
- Homepage recommendation data migration and Sprint 7 CMS work.
