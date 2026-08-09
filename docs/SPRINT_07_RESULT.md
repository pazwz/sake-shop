# Sprint 7 — CMS Foundation / Featured Collections

## Repository

- Added `FeaturedCollectionRepository` for published collection reads, type and
  season filtering, home collection reads, and the required create, update, and
  delete operations.
- Product, image, category, and read-only inventory mirror relations are loaded
  with each collection for the homepage response.

## Service and API

- Added `FeaturedCollectionService`, which assembles the entire homepage
  payload and determines the current season from the current date.
- Added `GET /api/v1/home`. It returns one standard API response containing
  Hero, all seasonal collections with `currentSeason`, Shopkeeper, Gift,
  Editorial, and Story collections.

## Development seed

- Added development-only published CMS seed records: three Hero, four seasonal
  collections (one each for spring, summer, autumn, and winter), three
  Shopkeeper, three Gift, three Editorial, and two Story collections.
- Each seeded collection is linked to two existing `dev-` products. Image URLs
  remain Unsplash development URLs.

## Homepage migration

- The homepage now makes one request to `/api/v1/home` and renders Hero,
  seasonal recommendations, Shopkeeper, Gift, Editorial, and Story content
  from the database response.
- The season control initializes to the API-provided current season.
- When homepage CMS data is unavailable, the page shows a formal empty state;
  it does not fall back to mock collections.

## Not included

- Admin CMS screens, authentication, payment, orders, Smaregi synchronization,
  S3, and AWS integration remain outside Sprint 7 scope.

## Verification

- `pnpm prisma:seed` passed.
- `pnpm prisma generate` passed.
- `pnpm lint` passed.
- `pnpm build` passed.
