import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  AdminProductImageInput,
  AdminProductQuery,
  AdminProductUpdate,
} from '@/validators/admin-product.validator';

const include = {
  category: true,
  images: { orderBy: { displayOrder: 'asc' as const } },
  inventoryMirrors: { orderBy: { smaregiStoreId: 'asc' as const } },
} satisfies Prisma.ProductInclude;

export type AdminProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof include;
}>;

export class AdminProductRepository {
  public async findMany(query: AdminProductQuery) {
    const where = this.buildWhere(query);
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

  public findById(id: string) {
    return prisma.product.findUnique({ where: { id }, include });
  }

  public findSlugOwner(slug: string) {
    return prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });
  }

  public update(id: string, data: AdminProductUpdate) {
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

  private buildWhere(query: AdminProductQuery): Prisma.ProductWhereInput {
    return {
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { productCode: { contains: query.q, mode: 'insensitive' } },
              {
                smaregiProductId: {
                  contains: query.q,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(query.category ? { categoryId: query.category } : {}),
      ...(query.ecStatus === 'published'
        ? { isEcAvailable: true }
        : query.ecStatus === 'unpublished'
          ? { isEcAvailable: false }
          : {}),
      ...(query.source === 'smaregi'
        ? { lastSyncedAt: { not: null } }
        : query.source === 'local'
          ? { lastSyncedAt: null }
          : {}),
    };
  }
}
