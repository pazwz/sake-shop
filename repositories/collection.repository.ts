import {
  CollectionStatus,
  CollectionType,
  Prisma,
  Season,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
const include = {
  products: {
    include: {
      product: {
        include: { images: true, inventoryMirrors: true, category: true },
      },
    },
    orderBy: { displayOrder: 'asc' as const },
  },
};

const visibleOnHomepage = {
  status: CollectionStatus.PUBLISHED,
} as const;

export class FeaturedCollectionRepository {
  findAdminCollections() {
    return prisma.featuredCollection.findMany({
      include,
      orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
  findAdminById(id: string) {
    return prisma.featuredCollection.findUnique({ where: { id }, include });
  }
  findPublished() {
    return prisma.featuredCollection.findMany({
      where: visibleOnHomepage,
      include,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
  findByType(type: CollectionType) {
    return prisma.featuredCollection.findMany({
      where: {
        ...visibleOnHomepage,
        type,
      },
      include,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
  findBySeason(season: Season) {
    return prisma.featuredCollection.findMany({
      where: {
        ...visibleOnHomepage,
        type: CollectionType.SEASONAL,
        season,
      },
      include,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
  findHomeCollections() {
    return this.findPublished();
  }
  create(data: Prisma.FeaturedCollectionCreateInput) {
    return prisma.featuredCollection.create({ data, include });
  }
  update(id: string, data: Prisma.FeaturedCollectionUpdateInput) {
    return prisma.featuredCollection.update({ where: { id }, data, include });
  }
  delete(id: string) {
    return prisma.$transaction(async (transaction) => {
      await transaction.featuredCollectionProduct.deleteMany({
        where: { featuredCollectionId: id },
      });
      return transaction.featuredCollection.delete({ where: { id } });
    });
  }
  replaceProducts(id: string, productIds: string[]) {
    return prisma.$transaction(async (transaction) => {
      await transaction.featuredCollectionProduct.deleteMany({
        where: { featuredCollectionId: id },
      });
      if (productIds.length > 0) {
        await transaction.featuredCollectionProduct.createMany({
          data: productIds.map((productId, index) => ({
            featuredCollectionId: id,
            productId,
            displayOrder: index + 1,
          })),
        });
      }
      return transaction.featuredCollection.findUniqueOrThrow({
        where: { id },
        include,
      });
    });
  }
  updateDisplayOrder(ids: string[]) {
    return prisma.$transaction(
      ids.map((id, index) =>
        prisma.featuredCollection.update({
          where: { id },
          data: { displayOrder: index + 1 },
        }),
      ),
    );
  }
}
