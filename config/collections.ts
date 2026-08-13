export const COLLECTION_PATHS = {
  seasonal: '/collections/seasonal',
  spring: '/collections/spring',
  summer: '/collections/summer',
  autumn: '/collections/autumn',
  winter: '/collections/winter',
  shopkeeper: '/collections/shopkeeper-choice',
  gift: '/collections/gift',
  editorial: '/collections/editorial',
  story: (collectionId: string) => `/collections/story-${collectionId}`,
} as const;

export const SEASON_COLLECTION_SLUGS = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter',
} as const;

export type SeasonCollectionSlug =
  (typeof SEASON_COLLECTION_SLUGS)[keyof typeof SEASON_COLLECTION_SLUGS];
