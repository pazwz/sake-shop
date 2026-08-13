# Editorial Section Architecture Review

Date: 2026-08-13

Status: Awaiting approval before Prisma schema or migration changes

## 1. Current limitation

`FeaturedCollection.description` is one nullable text value shared by every
collection type. It can provide an Editorial introduction, but it cannot model
multiple ordered article sections with an independent heading, body, image, and
featured product. `FeaturedCollectionProduct` represents the final ordered
selection for a collection; it cannot carry section-specific copy or express
which product is featured inside which article section.

## 2. Proposed schema

Add one purpose-specific model only:

```prisma
model EditorialSection {
  id            String             @id @default(cuid())
  collectionId  String             @map("collection_id")
  productId     String?            @map("product_id")
  title         String
  body          String
  imageUrl      String?            @map("image_url")
  displayOrder  Int                @default(0) @map("display_order")
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")
  collection    FeaturedCollection @relation(fields: [collectionId], references: [id], onDelete: Restrict)
  product       Product?           @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([collectionId, displayOrder])
  @@index([productId])
  @@map("editorial_sections")
}
```

Add inverse relations only:

- `FeaturedCollection.editorialSections EditorialSection[]`
- `Product.editorialSections EditorialSection[]`

No enum, existing field, or existing relation changes are needed.

## 3. Relations

- One `FeaturedCollection` has zero or more ordered `EditorialSection` rows.
- One section belongs to exactly one collection.
- One section may feature zero or one product.
- A product may be referenced by multiple sections and multiple Editorials.
- The service will permit section writes only when the parent collection type is
  `EDITORIAL`; this business invariant is not expressible as a Prisma relation.
- The final product grid remains sourced exclusively from
  `FeaturedCollectionProduct`. A section product is contextual editorial content
  and does not implicitly add or reorder that final selection.

## 4. Migration strategy

Create a forward-only migration that adds the new `editorial_sections` table,
its foreign keys, and indexes. Every field belongs to the new table, so existing
tables and rows are untouched. No destructive data conversion or backfill is
required.

## 5. Existing data compatibility

Existing Editorials initially have zero sections and continue rendering the
current Hero + `description` + ordered product grid fallback. Hero, Seasonal,
Shopkeeper, Gift, Story, and Brewery queries remain valid and do not render
sections. Public Editorial detail queries will include ordered sections; other
collection behavior remains unchanged.

## 6. Seed impact

The development seed will upsert three deterministic sections for the existing
`九州の風土` Editorial after that collection and its products exist. Section
identity must be stable across repeated seed runs, and stale seed-owned example
sections will be updated rather than duplicated. The seed remains blocked in
production and must pass twice consecutively.

## 7. Why not JSON

A JSON blob would remove foreign-key validation for products, make ordering and
partial updates error-prone, prevent safe product deletion behavior, weaken
TypeScript/Prisma inference, and force the CMS to replace an entire article for
every small edit. It would also encourage a generic page-builder structure that
is explicitly out of scope.

## 8. Risks and controls

- **Wrong collection type:** Service rejects section CRUD unless the parent is
  `EDITORIAL`.
- **Concurrent reorder:** A transactional replace/update operation validates an
  exact, unique ID set before persisting order.
- **Deleted product:** `onDelete: SetNull` preserves article copy and image.
- **Deleted collection:** Existing collection deletion/archiving behavior must
  explicitly handle sections; Editorial deletion is currently archival, so no
  section data is lost.
- **Orphan S3 image:** The existing media ownership limitation remains. Section
  image replacement/removal clears only the URL; automatic S3 cleanup remains
  out of scope.
- **Server/client serialization:** Public SSR DTOs convert Decimal values to
  numbers and dates to ISO strings before any section data reaches a Client
  Component. The Editorial detail itself remains a Server Component.

## Approval boundary

No Prisma schema, migration, repository, service, API, seed, or Editorial UI
change described above will be implemented until this review is approved.
