# Brand Experience Result

Date: 2026-08-13

## Scope

This maintenance increment improves the storefront's editorial presentation and
interaction feedback without starting a new numbered sprint. Product, order,
payment, Smaregi, AWS media, authentication, and Prisma schema architecture are
unchanged.

## Editorial CMS

- The homepage supports one to three published Editorial collections.
- OWNER and MANAGER can add, edit, reorder, and remove Editorial entries from
  `/admin/collections`. STAFF retains read-only access.
- Reordering uses `PATCH /api/v1/admin/collections/editorial/order` through the
  existing Route → Service → Repository → Prisma layers.
- Service rules reject a fourth published Editorial and prevent removal or
  unpublishing of the last published Editorial.
- Editorial removal is non-destructive: the collection is archived. The CMS
  uses an inline confirmation state rather than a blocking browser dialog.
- Collection mobile images remain optional. The form explains that a mobile
  override is only needed when the composition should differ.

## Storefront Presentation

- One Editorial uses a full-width feature treatment.
- Two Editorial entries use an asymmetric magazine layout.
- Three Editorial entries use one lead feature with two supporting features.
- Each Editorial links to its own SSR detail URL using the collection ID.
- Editorial detail pages use an image-led cover treatment and stronger title
  hierarchy. Story pages use a quieter, text-first treatment and warm paper
  background.
- Existing seasonal, Shopkeeper, Gift, Editorial, and Story product selection
  continues to come from ordered `FeaturedCollectionProduct` relations.

## Motion and Feedback

- Route and client data loading use a delayed KURA pour loader. The loader is
  not shown until 280 ms, so fast transitions are not artificially delayed.
- Homepage and collection content reveal on scroll. Newly inserted client
  content is registered through a mutation observer.
- Hero, product cards, links, and cart feedback use restrained transitions.
- `prefers-reduced-motion` disables non-essential animation and smooth scroll.
- Adding a product displays a three-second, dismissible cart toast with image,
  name, price, and a cart link. Repeated additions reset the timer.
- Product, cart, and collection empty states use a shared branded illustration
  and a useful next action.

## Images and Responsive Behavior

- Homepage and collection cover images retain the main/mobile `<picture>`
  fallback and Next Image optimization.
- Fill images now have a positioned `<picture>` parent, eliminating the Next
  Image invalid-parent warning.
- Above-the-fold art-directed images use `fetchPriority="high"`, as recommended
  by the local Next.js 16 image documentation. This avoids preloading both
  desktop and mobile candidates.
- Default object positions are applied by content type without adding focal
  point fields to the database.
- The mobile header hides the secondary login shortcut to prevent overlap with
  the centered KURA wordmark. Login remains available through the menu flow.

## Footer

- The social area is limited to Instagram and Xiaohongshu.
- Approved URLs live in `config/site.ts`. Until customer URLs are supplied,
  labels are visible but non-clickable, so no guessed or fake account is linked.

## Verification

- `pnpm prisma generate`: passed.
- `pnpm lint`: passed.
- `pnpm build`: passed.
- Browser: homepage SSR content, collection links, Editorial and Story detail,
  unknown collection 404, responsive 390 px layout, mobile header, cart toast,
  and branded cart empty state verified.
- Editorial fixtures: one-, two-, and three-entry layouts verified against a
  live development database. Temporary records were removed after testing.
- Editorial constraints: fourth entry rejected, reorder persisted and restored,
  last-entry removal rejected.
- Permissions: OWNER and MANAGER order writes returned 200; STAFF returned 403.

## Remaining Customer Inputs

- Approved Instagram URL.
- Approved Xiaohongshu URL.
- Final production contact, license, and support details already marked as
  pending elsewhere in project documentation.
