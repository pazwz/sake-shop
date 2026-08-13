# Public Collection Detail Result

Date: 2026-08-13

Status: Completed feature extension within the existing CMS architecture

---

## Public routes

The storefront now provides server-rendered collection pages:

- `/collections/seasonal`
- `/collections/spring`
- `/collections/summer`
- `/collections/autumn`
- `/collections/winter`
- `/collections/shopkeeper-choice`
- `/collections/gift`
- `/collections/editorial`
- `/collections/story-{collectionId}` for each currently visible Story

Unknown or currently unavailable slugs return the Next.js 404 response.

## Data source and ordering

Pages use the current published FeaturedCollection selected by the existing
Service and Repository layers. Products come exclusively from
FeaturedCollectionProduct and retain its `displayOrder`. Product category or
season is never used to rebuild a collection.

Homepage limits and detail-page quantities are separate. Shopkeeper and Gift
show their first three products on the homepage, while their detail pages show
every associated product. Seasonal detail pages likewise show all associated
products.

## Content and CMS

The existing nullable `FeaturedCollection.description` field already supports
feature introductions, so no schema or migration was required. The existing
Admin textarea remains the editing interface. The development seed now adds
default descriptions and uses the four seasonal titles shown in the seasonal
index.

## Rendering and UI

Collection pages are dynamic Server Components and query through Service and
Repository without a browser initialization request. The design uses the
existing responsive image behavior and ProductCard component. Collections
without products display `現在掲載できる商品はありません`.
