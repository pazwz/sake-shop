# Homepage CMS Simplification Result

Date: 2026-08-12

Status: Completed maintenance work (no new sprint started)

---

## Scope

The homepage CMS was simplified around the content currently visible to
customers. No Prisma schema, migration, AWS infrastructure, authentication
model, API response shape, or homepage SSR architecture was changed.

## Current-content selection

Homepage and Admin use the same Service selection rules:

- Hero: first published item, one item.
- Seasonal: first published item in each Spring, Summer, Autumn, and Winter
  slot. The storefront selects its current seasonal slot as before.
- Shopkeeper: first published area, at most three ordered products.
- Gift: first published area, at most three ordered products.
- Editorial: first published item, one item, matching the current homepage.
- Story: first two published items.

Ordering is deterministic by `displayOrder` and then `createdAt`. Historical
records remain compatible but are not presented as current content.

## Publication scheduling

`publishStartAt` and `publishEndAt` remain in the database for compatibility,
but are no longer displayed or submitted by the Admin form. Homepage selection
does not depend on future start or end times. Operators directly choose whether
content is displayed through its existing status.

## Admin experience

`/admin/collections` no longer exposes candidate counts, active record counts,
publication windows, scheduled status, or raw Collection concepts. It shows:

- one current main visual;
- four fixed seasonal slots;
- current Shopkeeper and Gift product names and counts;
- one current Editorial item;
- two current Story items.

Story's add action is hidden once both visible positions are filled. The form
keeps non-blocking save, upload, and error feedback. The smartphone image stays
optional and falls back to the main image.

## Development seed

The idempotent, development-only seed now creates one Hero, four Seasonal
records, one Shopkeeper record with three products, one Gift record with three
products, one Editorial record, and two Story records. Exact superseded seed
fixtures are archived, never deleted. User-created records are not identified
or changed by title heuristics.

## Authorization and architecture

OWNER and MANAGER retain CMS write access. STAFF remains read-only in the page
and receives API authorization failures for writes. The existing Route →
Service → Repository → Prisma layering and server-rendered homepage remain in
place.

## Remaining issues

- Historical records are intentionally retained and have no dedicated archive
  browser in the simplified operator UI.
- Orphan media cleanup remains pending because media ownership and shared URL
  references are not modeled.
