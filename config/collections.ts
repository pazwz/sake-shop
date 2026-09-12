export const COLLECTION_PATHS = {
  seasonal: '/collections/seasonal',
  spring: '/collections/spring',
  summer: '/collections/summer',
  autumn: '/collections/autumn',
  winter: '/collections/winter',
  shopkeeper: '/collections/shopkeeper-choice',
  gift: '/collections/gift',
  editorial: (collectionId: string) => `/collections/editorial-${collectionId}`,
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

export const isPublicCollectionAt = (
  collection: {
    status: string;
    publishStartAt: Date | null;
    publishEndAt: Date | null;
  },
  now = new Date(),
) =>
  collection.status === 'PUBLISHED' &&
  (!collection.publishStartAt || collection.publishStartAt <= now) &&
  (!collection.publishEndAt || collection.publishEndAt >= now);

export const getPublicCollectionPath = (collection: {
  id: string;
  type: string;
  season: keyof typeof SEASON_COLLECTION_SLUGS | null;
}) => {
  if (collection.type === 'SEASONAL' && collection.season) {
    return `/collections/${SEASON_COLLECTION_SLUGS[collection.season]}`;
  }
  if (collection.type === 'SHOPKEEPER') return COLLECTION_PATHS.shopkeeper;
  if (collection.type === 'GIFT') return COLLECTION_PATHS.gift;
  if (collection.type === 'EDITORIAL') {
    return COLLECTION_PATHS.editorial(collection.id);
  }
  if (collection.type === 'STORY') return COLLECTION_PATHS.story(collection.id);
  return null;
};
