# Editorial Magazine Result

Date: 2026-08-14

Status: Completed

## Implemented scope

- Added the purpose-specific `EditorialSection` model approved in the
  Architecture Review.
- Each section stores a title, body, optional image URL, display order, and at
  most one optional featured product.
- Section management is available only on existing Editorial collection edit
  pages. OWNER and MANAGER can replace the ordered section set; STAFF remains
  read-only at the API layer and cannot enter the edit page.
- Add, edit, delete, and reorder operations are persisted by one transactional
  Service/Repository operation with an exact ID-set concurrency check.
- Section images reuse the existing authenticated S3/CloudFront media upload
  component and API. AWS infrastructure and credential handling were not
  changed.
- The public Editorial article remains a Server Component. Desktop layouts
  alternate image and copy; mobile layouts keep image, copy, and featured
  product in a single reading column.

## Data semantics

`EditorialSection.productId` is contextual article content only. It neither
adds a product to the collection nor changes its final product order. The final
selection continues to come exclusively from ordered
`FeaturedCollectionProduct` rows.

Collections of other types cannot write Editorial sections. A deleted featured
product clears the optional section relation through `onDelete: SetNull`, while
the article copy remains intact.

## Legacy compatibility

An Editorial with zero sections does not render the article-section wrapper.
Its existing Hero, description, and ordered product selection continue to
render exactly as the legacy fallback. Existing records required no backfill.

## API

`GET /api/v1/admin/collections/{id}/editorial-sections`

- OWNER, MANAGER, STAFF: allowed.
- Returns only plain section DTO fields; Prisma relations, Decimal values, and
  Date values are not exposed.

`PUT /api/v1/admin/collections/{id}/editorial-sections`

- OWNER, MANAGER: allowed.
- STAFF: forbidden.
- Replaces the complete ordered section set after Zod validation.
- Maximum: 24 sections.

## Seed and migration

Migration `20260813151250_add_editorial_sections` creates only the new table,
indexes, and foreign keys. It does not alter existing collection or product
data.

The development seed upserts three deterministic sections for `九州の風土`.
Running the seed consecutively leaves exactly those three rows in display order
1–3 and does not duplicate them.

## Verification

- `pnpm prisma format`: passed.
- `pnpm prisma validate`: passed.
- `pnpm prisma generate`: passed.
- `pnpm prisma migrate status`: database schema up to date.
- `pnpm prisma db seed` twice consecutively: passed; deterministic row IDs and
  ordering confirmed.
- `pnpm lint`: passed, including TypeScript no-emit checking.
- `pnpm build`: passed with the Editorial detail route remaining dynamic SSR.
- Runtime CRUD: add, edit, delete, reorder, and restoration passed.
- Runtime authorization: unauthenticated GET 401; STAFF GET 200 / PUT 403;
  MANAGER and OWNER GET/PUT 200. STAFF edit-page access redirects away.
- Responsive runtime: desktop alternation and mobile single-column ordering
  confirmed. No browser console warning or error was emitted.

## Known limitation

As with existing collection media, replacing or clearing a section image removes
only the stored URL. Automatic deletion of the old S3 object requires a future
media ownership/cleanup design and remains outside this approved scope.
