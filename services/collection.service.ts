import { CollectionStatus, CollectionType, Season } from '@prisma/client';
import { HOME_CONTENT_LIMITS } from '@/config/home';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
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

const selectHomepageContent = <
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
    shopkeeper: limitCollectionProducts(
      by(CollectionType.SHOPKEEPER).slice(0, 1),
      HOME_CONTENT_LIMITS.shopkeeperProducts,
    ),
    gift: limitCollectionProducts(
      by(CollectionType.GIFT).slice(0, 1),
      HOME_CONTENT_LIMITS.giftProducts,
    ),
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
    const current = selectHomepageContent(all);
    return {
      ...current,
      currentSeason: getCurrentSeason(),
    };
  }
  async getAdminCollections() {
    return this.repository.findAdminCollections();
  }
  async getAdminHomeManagement() {
    const all = await this.repository.findAdminCollections();
    const current = selectHomepageContent(all);

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
    this.validateProductLimit(input.type, input.productIds);
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
    const existing = await this.getAdminCollection(id);
    this.validateProductLimit(
      input.type ?? existing.type,
      input.productIds ?? existing.products.map(({ product }) => product.id),
    );
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
    const collection = await this.getAdminCollection(id);
    this.validateProductLimit(collection.type, productIds);
    return this.repository.replaceProducts(id, productIds);
  }

  private validateProductLimit(type: CollectionType, productIds: string[]) {
    const maximum =
      type === CollectionType.SHOPKEEPER
        ? HOME_CONTENT_LIMITS.shopkeeperProducts
        : type === CollectionType.GIFT
          ? HOME_CONTENT_LIMITS.giftProducts
          : null;
    if (maximum !== null && productIds.length > maximum) {
      throw new ValidationError(`掲載商品は${maximum}件まで選択できます。`);
    }
  }
}
