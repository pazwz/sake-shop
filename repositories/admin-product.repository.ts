import { Prisma } from '@prisma/client';
import {
  SMAREGI_BOX_CATEGORY_ID,
  SMAREGI_PACKAGE_ONLY_PRODUCT_IDS,
} from '@/config/box-products';
import { prisma } from '@/lib/prisma';
import type {
  AdminProductImageInput,
  AdminProductQuery,
  AdminProductUpdate,
} from '@/validators/admin-product.validator';
import type { ProductEcStatus } from '@/types/product-ec-status';

const include = {
  category: true,
  images: { orderBy: { displayOrder: 'asc' as const } },
  inventoryMirrors: { orderBy: { smaregiStoreId: 'asc' as const } },
  boxProduct: {
    include: {
      category: true,
      inventoryMirrors: { orderBy: { smaregiStoreId: 'asc' as const } },
    },
  },
} satisfies Prisma.ProductInclude;

export type AdminProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof include;
}>;

export const buildAdminProductWhere = (
  query: AdminProductQuery,
  excludedSmaregiProductIds: readonly string[] = [],
): Prisma.ProductWhereInput => {
  const filters: Prisma.ProductWhereInput[] = [
    ...(query.q
      ? [
          {
            OR: [
              {
                name: { contains: query.q, mode: Prisma.QueryMode.insensitive },
              },
              {
                productCode: {
                  contains: query.q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                smaregiProductId: {
                  contains: query.q,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          },
        ]
      : []),
    ...(query.category ? [{ categoryId: query.category }] : []),
    ...(query.source === 'smaregi'
      ? [{ lastSyncedAt: { not: null } }]
      : query.source === 'local'
        ? [{ lastSyncedAt: null }]
        : []),
    ...(query.imageStatus === 'with'
      ? [{ images: { some: {} } }]
      : query.imageStatus === 'without'
        ? [{ images: { none: {} } }]
        : []),
  ].filter((filter) => Object.keys(filter).length > 0);

  const activeExclusion = {
    smaregiProductId: { in: [...excludedSmaregiProductIds] },
  };
  const notExcluded = excludedSmaregiProductIds.length
    ? { NOT: activeExclusion }
    : {};
  const statusFilters: Record<
    Exclude<AdminProductQuery['ecStatus'], 'all'>,
    Prisma.ProductWhereInput
  > = {
    published: { isActive: true, isEcAvailable: true, isManuallyHidden: false },
    preparing: {
      isActive: true,
      isEcAvailable: false,
      isManuallyHidden: false,
    },
    hidden: { isActive: true, isManuallyHidden: true },
    excluded: activeExclusion,
    retired: { isActive: false },
  };
  if (query.ecStatus === 'excluded') filters.push(activeExclusion);
  else if (query.ecStatus !== 'all') {
    filters.push(notExcluded, statusFilters[query.ecStatus]);
  }
  return filters.length ? { AND: filters } : {};
};

export class AdminProductRepository {
  public async findMany(
    query: AdminProductQuery,
    excludedSmaregiProductIds: readonly string[] = [],
  ) {
    const where = buildAdminProductWhere(query, excludedSmaregiProductIds);
    const [items, total, categories] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include,
        orderBy: [{ lastSyncedAt: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
      prisma.category.findMany({
        where: { products: { some: {} } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { items, total, categories };
  }

  public async findActiveExclusionSmaregiProductIds() {
    const exclusions = await prisma.smaregiProductExclusion.findMany({
      where: { revokedAt: null },
      select: { smaregiProductId: true },
    });
    return exclusions.map(({ smaregiProductId }) => smaregiProductId);
  }

  public async countEcStatuses(
    query: AdminProductQuery,
    excludedSmaregiProductIds: readonly string[],
  ): Promise<Record<ProductEcStatus, number>> {
    const baseQuery = { ...query, ecStatus: 'all' as const, page: 1 };
    const statuses: Array<[ProductEcStatus, AdminProductQuery['ecStatus']]> = [
      ['PUBLISHED', 'published'],
      ['PREPARING', 'preparing'],
      ['HIDDEN', 'hidden'],
      ['EC_EXCLUDED', 'excluded'],
      ['RETIRED', 'retired'],
    ];
    const counts = await Promise.all(
      statuses.map(
        async ([status, ecStatus]) =>
          [
            status,
            await prisma.product.count({
              where: buildAdminProductWhere(
                { ...baseQuery, ecStatus },
                excludedSmaregiProductIds,
              ),
            }),
          ] as const,
      ),
    );
    return Object.fromEntries(counts) as Record<ProductEcStatus, number>;
  }

  public findById(id: string) {
    return prisma.product.findUnique({ where: { id }, include });
  }

  public findBoxCandidates(compatibleSmaregiProductIds: readonly string[]) {
    if (compatibleSmaregiProductIds.length === 0) return Promise.resolve([]);
    return prisma.product.findMany({
      where: {
        lastSyncedAt: { not: null },
        smaregiProductId: { in: [...compatibleSmaregiProductIds] },
        OR: [
          { smaregiProductId: { in: [...SMAREGI_PACKAGE_ONLY_PRODUCT_IDS] } },
          { category: { smaregiCategoryId: SMAREGI_BOX_CATEGORY_ID } },
        ],
      },
      include: {
        category: true,
        inventoryMirrors: { orderBy: { smaregiStoreId: 'asc' } },
      },
      orderBy: [{ name: 'asc' }, { smaregiProductId: 'asc' }],
    });
  }

  public findSlugOwner(slug: string) {
    return prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
  }

  public findBoxOwner(boxProductId: string) {
    return prisma.product.findFirst({
      where: { boxProductId },
      select: { id: true, name: true },
    });
  }

  public update(
    id: string,
    data: AdminProductUpdate & { isManuallyHidden?: boolean },
  ) {
    return prisma.product.update({ where: { id }, data, include });
  }

  public async createImage(id: string, input: AdminProductImageInput) {
    return prisma.$transaction(async (transaction) => {
      const last = await transaction.productImage.findFirst({
        where: { productId: id },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      return transaction.productImage.create({
        data: {
          productId: id,
          imageUrl: input.imageUrl,
          imageType: 'PRODUCT',
          displayOrder: (last?.displayOrder ?? 0) + 1,
          altText: input.altText ?? null,
        },
      });
    });
  }

  public findImage(productId: string, imageId: string) {
    return prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
  }

  public deleteImage(imageId: string) {
    return prisma.productImage.delete({ where: { id: imageId } });
  }

  public async reorderImages(productId: string, imageIds: string[]) {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.productImage.findMany({
        where: { productId },
        select: { id: true },
      });
      const currentIds = new Set(current.map(({ id }) => id));
      const requestedIds = new Set(imageIds);
      if (
        currentIds.size !== imageIds.length ||
        requestedIds.size !== imageIds.length ||
        imageIds.some((id) => !currentIds.has(id))
      ) {
        return null;
      }
      await Promise.all(
        imageIds.map((id, index) =>
          transaction.productImage.update({
            where: { id },
            data: { displayOrder: index + 1 },
          }),
        ),
      );
      return transaction.productImage.findMany({
        where: { productId },
        orderBy: { displayOrder: 'asc' },
      });
    });
  }
}
