import { CollectionStatus, CollectionType, Season } from '@prisma/client';
import { HOME_CONTENT_LIMITS } from '@/config/home';
import type { SeasonCollectionSlug } from '@/config/collections';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { FeaturedCollectionRepository } from '@/repositories/collection.repository';
import { ProductRepository } from '@/repositories/product.repository';
import type {
  CollectionInput,
  CollectionUpdate,
  EditorialSectionInput,
} from '@/validators/collection.validator';

const createUniqueProductFilter = () => {
  const productIds = new Set<string>();
  return <T extends { product: { id: string } }>({ product }: T) => {
    if (productIds.has(product.id)) return false;
    productIds.add(product.id);
    return true;
  };
};

export const sanitizePublicCollections = <
  T extends {
    products: Array<{
      product: { isActive: boolean; isEcAvailable: boolean };
    }>;
    editorialSections: Array<{
      product: { isActive: boolean; isEcAvailable: boolean } | null;
    }>;
  },
>(
  collections: T[],
) =>
  collections.map((collection) => ({
    ...collection,
    products: collection.products.filter(
      ({ product }) => product.isActive && product.isEcAvailable,
    ),
    editorialSections: collection.editorialSections.map((section) => ({
      ...section,
      product:
        section.product?.isActive && section.product.isEcAvailable
          ? section.product
          : null,
    })),
  }));

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
    private readonly productRepository = new ProductRepository(),
  ) {}
  async getHome() {
    const all = sanitizePublicCollections(
      await this.repository.findHomeCollections(),
    );
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
    const all = sanitizePublicCollections(
      await this.repository.findHomeCollections(),
    );
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
    if (slug.startsWith('editorial-')) {
      const collectionId = slug.slice('editorial-'.length);
      return (
        current.editorial.find(
          (collection) => collection.id === collectionId,
        ) ?? null
      );
    }
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
    const all = sanitizePublicCollections(
      await this.repository.findHomeCollections(),
    );
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
    if (
      input.type === CollectionType.EDITORIAL &&
      input.status === CollectionStatus.PUBLISHED
    ) {
      await this.ensureEditorialCapacity();
    }
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
    const wasPublishedEditorial =
      existing.type === CollectionType.EDITORIAL &&
      existing.status === CollectionStatus.PUBLISHED;
    const willBePublishedEditorial =
      (input.type ?? existing.type) === CollectionType.EDITORIAL &&
      (input.status ?? existing.status) === CollectionStatus.PUBLISHED;
    if (!wasPublishedEditorial && willBePublishedEditorial) {
      await this.ensureEditorialCapacity();
    }
    if (wasPublishedEditorial && !willBePublishedEditorial) {
      await this.ensureEditorialMinimum();
    }
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
    if (collection.type === CollectionType.EDITORIAL) {
      if (
        collection.status === CollectionStatus.PUBLISHED &&
        (await this.repository.findByType(CollectionType.EDITORIAL)).length <= 1
      ) {
        throw new ConflictError('特集記事は1件以上必要です。');
      }
      await this.repository.update(id, {
        status: CollectionStatus.ARCHIVED,
      });
      return;
    }
    if (collection.status === CollectionStatus.PUBLISHED) {
      throw new ConflictError('Unpublish the collection before deleting it.');
    }
    return this.repository.delete(id);
  }
  async updateProductOrder(id: string, productIds: string[]) {
    await this.getAdminCollection(id);
    return this.repository.replaceProducts(id, productIds);
  }
  async updateEditorialOrder(ids: string[]) {
    if (ids.length < 1 || ids.length > HOME_CONTENT_LIMITS.editorial) {
      throw new ValidationError('特集記事は1件以上3件以下で設定してください。');
    }
    const currentIds = (
      await this.repository.findByType(CollectionType.EDITORIAL)
    )
      .filter((collection) => collection.status === CollectionStatus.PUBLISHED)
      .slice(0, HOME_CONTENT_LIMITS.editorial)
      .map((collection) => collection.id);
    if (
      ids.length !== currentIds.length ||
      ids.some((id) => !currentIds.includes(id))
    ) {
      throw new ConflictError('特集記事の状態が更新されています。');
    }
    return this.repository.updateDisplayOrder(ids);
  }

  async getAdminEditorialSections(id: string) {
    const collection = await this.getAdminCollection(id);
    this.ensureEditorialCollection(collection.type);
    return collection.editorialSections;
  }

  async replaceEditorialSections(
    id: string,
    sections: EditorialSectionInput[],
  ) {
    const collection = await this.getAdminCollection(id);
    this.ensureEditorialCollection(collection.type);

    const existingIds = collection.editorialSections.map(({ id }) => id);
    const existingIdSet = new Set(existingIds);
    if (
      sections.some((section) => section.id && !existingIdSet.has(section.id))
    ) {
      throw new ConflictError('記事内容の状態が更新されています。');
    }

    const productIds = [
      ...new Set(
        sections.flatMap((section) =>
          section.productId ? [section.productId] : [],
        ),
      ),
    ];
    if (productIds.length) {
      const products = await this.productRepository.findForOrder(productIds);
      if (products.length !== productIds.length) {
        throw new ValidationError('選択された商品が見つかりません。');
      }
    }

    const result = await this.repository.replaceEditorialSections(
      id,
      existingIds,
      sections,
    );
    if (!result) throw new ConflictError('記事内容の状態が更新されています。');
    return result;
  }

  private async ensureEditorialCapacity() {
    const published = await this.repository.findByType(
      CollectionType.EDITORIAL,
    );
    if (published.length >= HOME_CONTENT_LIMITS.editorial) {
      throw new ConflictError('特集記事は3件まで設定できます。');
    }
  }

  private async ensureEditorialMinimum() {
    const published = await this.repository.findByType(
      CollectionType.EDITORIAL,
    );
    if (published.length <= 1) {
      throw new ConflictError('特集記事は1件以上必要です。');
    }
  }

  private ensureEditorialCollection(type: CollectionType) {
    if (type !== CollectionType.EDITORIAL) {
      throw new ValidationError('記事内容は特集記事にのみ設定できます。');
    }
  }
}
