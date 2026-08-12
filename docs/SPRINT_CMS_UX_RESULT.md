# Admin CMS UX Refinement Result

Date: 2026-08-12

Status: Completed maintenance work (no new sprint started)

---

## Scope

The existing FeaturedCollection CMS was refined for liquor-store operators.
No Prisma schema, migration, Home API contract, homepage SSR architecture,
admin authentication, or AWS infrastructure was changed.

## Homepage Content Management

`/admin/collections` is now labeled `ホームページ管理` and organized by the
business areas visible on the homepage:

- `メインビジュアル`: shows current, scheduled, draft, archived, and ended
  content candidates with image, status, and publication window.
- `季節の特集`: shows Japanese Spring, Summer, Autumn, and Winter slots and
  identifies the current season.
- `店主のおすすめ`: presents one homepage area, the currently visible product
  count, product names, and any multiple-record merge condition.
- `ギフト`: presents one homepage area with the same final-product summary.
- `特集記事`: keeps multiple editorial content candidates as a list.
- `ストーリー`: keeps multiple story content candidates as a list.

When multiple published SHOPKEEPER or GIFT records already exist, they are not
deleted or silently merged in the database. The CMS explains that the homepage
uses display order, removes duplicate products, and shows the first three. This
matches the existing Home Service behavior.

## Collection Editing

The edit heading identifies the homepage area, for example:

- `メインビジュアルを編集`
- `季節の特集（夏）を編集`
- `店主のおすすめを編集`

Technical enum values remain request values but are displayed with Japanese
business labels. The product selector shows how many products are selected and
explains that the checked order is the homepage order.

## Image Rules

- `desktopImageUrl` is presented as `メイン画像`.
- `mobileImageUrl` is presented as `スマートフォン用画像（任意）`.
- If the optional mobile image is empty, the main image is used on smartphones.
- The optional image is only needed when a different smartphone composition is
  desired.
- Upload progress, timeout, errors, preview, replace, remove, and explicit
  upload-complete feedback are shown.
- Upload completion is clearly distinguished from saving the collection.
- Removing an image only clears the URL after the collection is saved.

The storefront keeps the existing responsive Next/Image behavior:

- Mobile image exists: mobile uses it; desktop uses the main image.
- Mobile image is empty: both use the main image.
- Main image is empty but mobile exists: both can fall back to the mobile image.
- Both are empty: no Image component is rendered.

## Save Feedback

Collection writes provide non-blocking feedback:

- `変更を保存`
- `保存中...`
- `保存しました ✓`
- `変更を保存しました。`

Success feedback clears automatically. API and network failures restore the
button state and display an error. A synchronous submission lock prevents rapid
double-click writes. Delete and upload states also recover in `finally` paths.

## Development Seed

The development seed remains idempotent and is blocked when
`NODE_ENV=production`.

- HERO keeps multiple content candidates.
- SEASONAL keeps one Japanese-labeled record for each season.
- SHOPKEEPER now seeds one `店主のおすすめ` record with three products.
- GIFT now seeds one `ギフトにおすすめ` record with three products.
- EDITORIAL and STORY keep multiple records.
- Exact legacy development fixtures `店主のおすすめ 2/3` and `贈り物 2/3`
  are archived, never deleted.
- No migration or destructive deletion is performed.

## Authorization

- OWNER and MANAGER can create, edit, publish, archive, upload images, and use
  existing delete behavior.
- STAFF may view the management overview but cannot open write pages or call
  create, update, delete, reorder, or media-upload APIs.
- API enforcement continues to use `requireAdmin(cmsAdminRoles)`.

## Frontend Consistency

The Home Service output contract is unchanged for HERO, SEASONAL, SHOPKEEPER,
GIFT, EDITORIAL, and STORY. Homepage SSR remains dynamic and does not restore an
initial browser fetch to `/api/v1/home`.

## Remaining Issue

`Orphan media cleanup pending`

An S3 upload may remain unreferenced when a collection save fails or an image
is replaced/removed. Immediate deletion is intentionally not implemented
because the current schema has no media ownership or reference-count model and
the same URL may be reused.
