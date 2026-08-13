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
  editorialSections: {
    include: {
      product: {
        include: {
          category: true,
          images: { orderBy: { displayOrder: 'asc' as const } },
        },
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
  replaceEditorialSections(
    collectionId: string,
    expectedIds: string[],
    sections: Array<{
      id?: string;
      title: string;
      body: string;
      imageUrl?: string | null;
      productId?: string | null;
    }>,
  ) {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.editorialSection.findMany({
        where: { collectionId },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      const currentIds = current.map(({ id }) => id);
      const expected = [...expectedIds].sort();
      if (
        currentIds.length !== expected.length ||
        currentIds.some((id, index) => id !== expected[index])
      ) {
        return null;
      }

      const retainedIds = sections.flatMap((section) =>
        section.id ? [section.id] : [],
      );
      await transaction.editorialSection.deleteMany({
        where: {
          collectionId,
          ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}),
        },
      });

      for (const [index, section] of sections.entries()) {
        const data = {
          title: section.title,
          body: section.body,
          imageUrl: section.imageUrl ?? null,
          productId: section.productId ?? null,
          displayOrder: index + 1,
        };
        if (section.id) {
          await transaction.editorialSection.update({
            where: { id: section.id },
            data,
          });
        } else {
          await transaction.editorialSection.create({
            data: { ...data, collectionId },
          });
        }
      }

      return transaction.editorialSection.findMany({
        where: { collectionId },
        include: {
          product: {
            include: {
              category: true,
              images: { orderBy: { displayOrder: 'asc' } },
            },
          },
        },
        orderBy: { displayOrder: 'asc' },
      });
    });
  }
}
