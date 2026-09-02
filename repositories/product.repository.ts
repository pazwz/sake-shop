import { Prisma, Season } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ProductQuery } from '@/validators/product.validator';

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
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

export const PUBLIC_PRODUCT_VISIBILITY = {
  isActive: true,
  isEcAvailable: true,
} as const;

export class ProductRepository {
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

  public async findMany(
    query: ProductQuery,
  ): Promise<{ items: ProductWithRelations[]; total: number }> {
    const where = this.buildWhere(query);
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: this.getOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  }

  public async findByCategory(
    category: string,
    query: ProductQuery,
  ): Promise<{ items: ProductWithRelations[]; total: number }> {
    return this.findMany({ ...query, category });
  }

  public async findActive(
    query: ProductQuery,
  ): Promise<{ items: ProductWithRelations[]; total: number }> {
    return this.findMany(query);
  }

  public async search(
    keyword: string,
    query: ProductQuery,
  ): Promise<{ items: ProductWithRelations[]; total: number }> {
    return this.findMany({ ...query, keyword });
  }

  private buildWhere(query: ProductQuery): Prisma.ProductWhereInput {
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
      AND: [categoryFilter, subcategoryFilter, keywordFilter, seasonFilter],
    };
  }

  private getOrderBy(
    sort: ProductQuery['sort'],
  ): Prisma.ProductOrderByWithRelationInput {
    if (sort === 'price_asc') return { price: 'asc' };
    if (sort === 'price_desc') return { price: 'desc' };

    return { createdAt: 'desc' };
  }
}
