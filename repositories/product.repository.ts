import { Prisma, Season } from '@prisma/client';
import { SMAREGI_BOX_CATEGORY_ID } from '@/config/box-products';
import { SMAREGI_NON_STANDALONE_PRODUCT_IDS } from '@/config/public-products';
import { getPublicProductNavigation } from '@/config/public-navigation';
import { getPublicProductEffectivePage } from '@/config/public-product-pagination';
import { prisma } from '@/lib/prisma';
import type { ProductQuery } from '@/validators/product.validator';
import type { CollectionProductCandidateQuery } from '@/validators/collection.validator';

export const STANDALONE_EC_PRODUCT_WHERE = {
  NOT: {
    OR: [
      { smaregiProductId: { in: [...SMAREGI_NON_STANDALONE_PRODUCT_IDS] } },
      { category: { smaregiCategoryId: SMAREGI_BOX_CATEGORY_ID } },
    ],
  },
} satisfies Prisma.ProductWhereInput;

const productInclude = {
  category: {
    include: {
      parent: true,
    },
  },
  images: {
    orderBy: {
      displayOrder: 'asc',
    },
  },
  inventoryMirrors: {
    orderBy: {
      createdAt: 'asc',
    },
  },
  boxProduct: {
    include: {
      category: true,
      inventoryMirrors: {
        orderBy: { createdAt: 'asc' as const },
      },
    },
  },
} satisfies Prisma.ProductInclude;

const productListInclude = {
  ...productInclude,
  images: {
    orderBy: { displayOrder: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

type ProductPage = {
  items: ProductWithRelations[];
  total: number;
  page: number;
};

export const PUBLIC_PRODUCT_VISIBILITY = {
  isActive: true,
  isEcAvailable: true,
  isManuallyHidden: false,
} as const;

export const getCollectionProductCandidateWhere = (
  query: Pick<CollectionProductCandidateQuery, 'q' | 'category'> = {},
): Prisma.ProductWhereInput => ({
  ...PUBLIC_PRODUCT_VISIBILITY,
  ...STANDALONE_EC_PRODUCT_WHERE,
  ...(query.category ? { categoryId: query.category } : {}),
  ...(query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { producer: { contains: query.q, mode: 'insensitive' } },
          { productCode: { contains: query.q, mode: 'insensitive' } },
        ],
      }
    : {}),
});

export class ProductRepository {
  public async findCollectionProductCandidates(
    query: CollectionProductCandidateQuery,
  ) {
    const where = getCollectionProductCandidateWhere(query);
    return prisma.$transaction(async (transaction) => {
      const total = await transaction.product.count({ where });
      const page = getPublicProductEffectivePage(
        query.page,
        total,
        query.limit,
      );
      const items = await transaction.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          productCode: true,
          slug: true,
          producer: true,
          isActive: true,
          isEcAvailable: true,
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * query.limit,
        take: query.limit,
      });
      return { items, total, page };
    });
  }

  public async findEligibleCollectionProductIds(ids: string[]) {
    if (!ids.length) return [];
    return prisma.product.findMany({
      where: {
        id: { in: ids },
        ...getCollectionProductCandidateWhere(),
      },
      select: { id: true },
    });
  }

  public async findForOrder(ids: string[]) {
    return prisma.product.findMany({
      where: { id: { in: ids } },
      include: productInclude,
    });
  }
  public async findById(id: string): Promise<ProductWithRelations | null> {
    return prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
  }

  public async findBySlug(slug: string): Promise<ProductWithRelations | null> {
    return prisma.product.findUnique({
      where: { slug },
      include: productInclude,
    });
  }

  public async isPublicSlug(slug: string): Promise<boolean> {
    const product = await prisma.product.findFirst({
      where: {
        slug,
        ...PUBLIC_PRODUCT_VISIBILITY,
        ...STANDALONE_EC_PRODUCT_WHERE,
      },
      select: { id: true },
    });

    return product !== null;
  }

  public async findMany(query: ProductQuery): Promise<ProductPage> {
    const where = this.buildWhere(query);
    return prisma.$transaction(async (transaction) => {
      const total = await transaction.product.count({ where });
      const page = getPublicProductEffectivePage(
        query.page,
        total,
        query.limit,
      );
      const items = await transaction.product.findMany({
        where,
        include: productListInclude,
        orderBy: this.getOrderBy(query.sort),
        skip: (page - 1) * query.limit,
        take: query.limit,
      });
      return { items, total, page };
    });
  }

  public async findByCategory(
    category: string,
    query: ProductQuery,
  ): Promise<ProductPage> {
    return this.findMany({ ...query, category });
  }

  public async findActive(query: ProductQuery): Promise<ProductPage> {
    return this.findMany(query);
  }

  public async search(
    keyword: string,
    query: ProductQuery,
  ): Promise<ProductPage> {
    return this.findMany({ ...query, keyword });
  }

  private buildWhere(query: ProductQuery): Prisma.ProductWhereInput {
    const navigationGroup = getPublicProductNavigation(query.group);
    const groupFilter = navigationGroup
      ? {
          OR: navigationGroup.terms.flatMap((term) => [
            { category: { name: { contains: term } } },
            { category: { parent: { name: { contains: term } } } },
          ]),
        }
      : {};
    const categoryFilter = query.category
      ? {
          OR: [
            { category: { slug: query.category } },
            { category: { name: query.category } },
            { category: { parent: { slug: query.category } } },
            { category: { parent: { name: query.category } } },
          ],
        }
      : {};
    const subcategoryFilter = query.subcategory
      ? {
          category: {
            OR: [{ slug: query.subcategory }, { name: query.subcategory }],
          },
        }
      : {};
    const keywordFilter = query.keyword
      ? {
          OR: [
            { name: { contains: query.keyword, mode: 'insensitive' as const } },
            {
              producer: {
                contains: query.keyword,
                mode: 'insensitive' as const,
              },
            },
            {
              origin: { contains: query.keyword, mode: 'insensitive' as const },
            },
            {
              productCode: {
                contains: query.keyword,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};
    const seasonFilter = query.season
      ? {
          featuredCollectionProducts: {
            some: {
              featuredCollection: {
                type: 'SEASONAL' as const,
                season: query.season.toUpperCase() as Season,
              },
            },
          },
        }
      : {};

    return {
      ...PUBLIC_PRODUCT_VISIBILITY,
      ...STANDALONE_EC_PRODUCT_WHERE,
      AND: [
        groupFilter,
        categoryFilter,
        subcategoryFilter,
        keywordFilter,
        seasonFilter,
      ],
    };
  }

  private getOrderBy(
    sort: ProductQuery['sort'],
  ): Prisma.ProductOrderByWithRelationInput[] {
    if (sort === 'price_asc') return [{ price: 'asc' }, { id: 'asc' }];
    if (sort === 'price_desc') return [{ price: 'desc' }, { id: 'asc' }];

    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}
