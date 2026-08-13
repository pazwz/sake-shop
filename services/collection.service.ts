import { CollectionStatus, CollectionType, Season } from '@prisma/client';
import { HOME_CONTENT_LIMITS } from '@/config/home';
import type { SeasonCollectionSlug } from '@/config/collections';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { FeaturedCollectionRepository } from '@/repositories/collection.repository';
import type {
  CollectionInput,
  CollectionUpdate,
} from '@/validators/collection.validator';

const createUniqueProductFilter = () => {
  const productIds = new Set<string>();
  return <T extends { product: { id: string } }>({ product }: T) => {
    if (productIds.has(product.id)) return false;
    productIds.add(product.id);
    return true;
  };
};

const limitCollectionProducts = <
  T extends { products: Array<{ product: { id: string } }> },
>(
  collections: T[],
  limit?: number,
) => {
  const uniqueProduct = createUniqueProductFilter();

  return collections.map((collection) => ({
    ...collection,
    products: collection.products.filter(uniqueProduct).slice(0, limit),
  }));
};

const getCurrentSeason = () =>
  [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER][
    Math.floor(new Date().getMonth() / 3)
  ];

const seasonBySlug: Record<SeasonCollectionSlug, Season> = {
  spring: Season.SPRING,
  summer: Season.SUMMER,
  autumn: Season.AUTUMN,
  winter: Season.WINTER,
};

const selectCurrentCollections = <
  T extends {
    type: CollectionType;
    season: Season | null;
    status: CollectionStatus;
    products: Array<{ product: { id: string } }>;
  },
>(
  all: T[],
) => {
  const published = all.filter(
    (collection) => collection.status === CollectionStatus.PUBLISHED,
  );
  const by = (type: CollectionType) =>
    published.filter((collection) => collection.type === type);
  const seasonal = [
    Season.SPRING,
    Season.SUMMER,
    Season.AUTUMN,
    Season.WINTER,
  ].flatMap((season) =>
    by(CollectionType.SEASONAL)
      .filter((collection) => collection.season === season)
      .slice(0, HOME_CONTENT_LIMITS.seasonalPerSeason),
  );

  return {
    hero: by(CollectionType.HERO).slice(0, HOME_CONTENT_LIMITS.hero),
    seasonal,
    shopkeeper: by(CollectionType.SHOPKEEPER).slice(0, 1),
    gift: by(CollectionType.GIFT).slice(0, 1),
    editorial: by(CollectionType.EDITORIAL).slice(
      0,
      HOME_CONTENT_LIMITS.editorial,
    ),
    story: by(CollectionType.STORY).slice(0, HOME_CONTENT_LIMITS.story),
  };
};

export class FeaturedCollectionService {
  constructor(
    private readonly repository = new FeaturedCollectionRepository(),
  ) {}
  async getHome() {
    const all = await this.repository.findHomeCollections();
    const current = selectCurrentCollections(all);
    return {
      ...current,
      shopkeeper: limitCollectionProducts(
        current.shopkeeper,
        HOME_CONTENT_LIMITS.shopkeeperProducts,
      ),
      gift: limitCollectionProducts(
        current.gift,
        HOME_CONTENT_LIMITS.giftProducts,
      ),
      currentSeason: getCurrentSeason(),
    };
  }
  async getPublicCollectionDetail(slug: string) {
    const all = await this.repository.findHomeCollections();
    const current = selectCurrentCollections(all);
    if (slug in seasonBySlug) {
      const season = seasonBySlug[slug as SeasonCollectionSlug];
      return (
        current.seasonal.find((collection) => collection.season === season) ??
        null
      );
    }
    if (slug === 'shopkeeper-choice') return current.shopkeeper[0] ?? null;
    if (slug === 'gift') return current.gift[0] ?? null;
    if (slug === 'editorial') return current.editorial[0] ?? null;
    if (slug.startsWith('story-')) {
      const collectionId = slug.slice('story-'.length);
      return (
        current.story.find((collection) => collection.id === collectionId) ??
        null
      );
    }
    return null;
  }
  async getPublicSeasonalCollections() {
    const all = await this.repository.findHomeCollections();
    return selectCurrentCollections(all).seasonal;
  }
  async getAdminCollections() {
    return this.repository.findAdminCollections();
  }
  async getAdminHomeManagement() {
    const all = await this.repository.findAdminCollections();
    const selected = selectCurrentCollections(all);
    const current = {
      ...selected,
      shopkeeper: limitCollectionProducts(
        selected.shopkeeper,
        HOME_CONTENT_LIMITS.shopkeeperProducts,
      ),
      gift: limitCollectionProducts(
        selected.gift,
        HOME_CONTENT_LIMITS.giftProducts,
      ),
    };

    return {
      currentSeason: getCurrentSeason(),
      hero: current.hero[0] ?? null,
      seasonal: [
        Season.SPRING,
        Season.SUMMER,
        Season.AUTUMN,
        Season.WINTER,
      ].map((season) => ({
        season,
        collection:
          current.seasonal.find((collection) => collection.season === season) ??
          null,
        fallback:
          all.find(
            (collection) =>
              collection.type === CollectionType.SEASONAL &&
              collection.season === season,
          ) ?? null,
      })),
      shopkeeper: current.shopkeeper[0] ?? null,
      gift: current.gift[0] ?? null,
      editorial: current.editorial,
      story: current.story,
      fallbacks: {
        hero:
          all.find((collection) => collection.type === CollectionType.HERO) ??
          null,
        shopkeeper:
          all.find(
            (collection) => collection.type === CollectionType.SHOPKEEPER,
          ) ?? null,
        gift:
          all.find((collection) => collection.type === CollectionType.GIFT) ??
          null,
      },
    };
  }
  async getAdminCollection(id: string) {
    const collection = await this.repository.findAdminById(id);
    if (!collection) throw new NotFoundError('Collection not found.');
    return collection;
  }
  async createCollection(input: CollectionInput) {
    const { productIds, publishStartAt, publishEndAt, ...data } = input;
    return this.repository.create({
      ...data,
      publishStartAt: publishStartAt ? new Date(publishStartAt) : null,
      publishEndAt: publishEndAt ? new Date(publishEndAt) : null,
      products: {
        create: productIds.map((productId, index) => ({
          productId,
          displayOrder: index + 1,
        })),
      },
    });
  }
  async updateCollection(id: string, input: CollectionUpdate) {
    await this.getAdminCollection(id);
    const { productIds, publishStartAt, publishEndAt, ...data } = input;
    const collection = await this.repository.update(id, {
      ...data,
      ...(publishStartAt !== undefined
        ? { publishStartAt: publishStartAt ? new Date(publishStartAt) : null }
        : {}),
      ...(publishEndAt !== undefined
        ? { publishEndAt: publishEndAt ? new Date(publishEndAt) : null }
        : {}),
    });
    return productIds === undefined
      ? collection
      : this.repository.replaceProducts(id, productIds);
  }
  async deleteCollection(id: string) {
    const collection = await this.getAdminCollection(id);
    if (collection.status === CollectionStatus.PUBLISHED) {
      throw new ConflictError('Unpublish the collection before deleting it.');
    }
    return this.repository.delete(id);
  }
  async updateProductOrder(id: string, productIds: string[]) {
    await this.getAdminCollection(id);
    return this.repository.replaceProducts(id, productIds);
  }
}
