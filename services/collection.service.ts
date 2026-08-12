import { CollectionStatus, CollectionType, Season } from '@prisma/client';
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

const deduplicateCollectionProducts = <
  T extends { products: Array<{ product: { id: string } }> },
>(
  collections: T[],
) => {
  const uniqueProduct = createUniqueProductFilter();

  return collections.map((collection) => ({
    ...collection,
    products: collection.products.filter(uniqueProduct),
  }));
};

const getCurrentSeason = () =>
  [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER][
    Math.floor(new Date().getMonth() / 3)
  ];

const isCurrentlyPublished = <
  T extends {
    status: CollectionStatus;
    publishStartAt: Date | null;
    publishEndAt: Date | null;
  },
>(collection: T, now: Date) =>
  collection.status === CollectionStatus.PUBLISHED &&
  (!collection.publishStartAt || collection.publishStartAt <= now) &&
  (!collection.publishEndAt || collection.publishEndAt > now);

export class FeaturedCollectionService {
  constructor(
    private readonly repository = new FeaturedCollectionRepository(),
  ) {}
  async getHome() {
    const all = await this.repository.findHomeCollections();
    const by = (type: CollectionType) =>
      deduplicateCollectionProducts(all.filter((item) => item.type === type));
    return {
      hero: by(CollectionType.HERO),
      currentSeason: getCurrentSeason(),
      seasonal: by(CollectionType.SEASONAL),
      shopkeeper: by(CollectionType.SHOPKEEPER),
      gift: by(CollectionType.GIFT),
      editorial: by(CollectionType.EDITORIAL),
      story: by(CollectionType.STORY),
    };
  }
  async getAdminCollections() {
    return this.repository.findAdminCollections();
  }
  async getAdminHomeManagement() {
    const all = await this.repository.findAdminCollections();
    const now = new Date();
    const by = (type: CollectionType) =>
      all.filter((collection) => collection.type === type);
    const area = (type: CollectionType) => {
      const records = by(type);
      const activeRecords = records.filter((record) =>
        isCurrentlyPublished(record, now),
      );
      const uniqueProduct = createUniqueProductFilter();
      const visibleProducts = activeRecords
        .flatMap((record) => record.products)
        .filter(uniqueProduct)
        .slice(0, 3);

      return { records, activeRecords, visibleProducts };
    };

    return {
      currentSeason: getCurrentSeason(),
      hero: by(CollectionType.HERO),
      seasonal: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER].map(
        (season) => ({
          season,
          records: by(CollectionType.SEASONAL).filter(
            (collection) => collection.season === season,
          ),
        }),
      ),
      shopkeeper: area(CollectionType.SHOPKEEPER),
      gift: area(CollectionType.GIFT),
      editorial: by(CollectionType.EDITORIAL),
      story: by(CollectionType.STORY),
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
