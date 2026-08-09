import { CollectionStatus, CollectionType, Season } from '@prisma/client';
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
export class FeaturedCollectionRepository {
  findPublished() {
    return prisma.featuredCollection.findMany({
      where: { status: CollectionStatus.PUBLISHED },
      include,
      orderBy: { displayOrder: 'asc' },
    });
  }
  findByType(type: CollectionType) {
    return prisma.featuredCollection.findMany({
      where: { type, status: CollectionStatus.PUBLISHED },
      include,
      orderBy: { displayOrder: 'asc' },
    });
  }
  findBySeason(season: Season) {
    return prisma.featuredCollection.findMany({
      where: {
        type: CollectionType.SEASONAL,
        season,
        status: CollectionStatus.PUBLISHED,
      },
      include,
      orderBy: { displayOrder: 'asc' },
    });
  }
  findHomeCollections() {
    return this.findPublished();
  }
  create(data: Parameters<typeof prisma.featuredCollection.create>[0]['data']) {
    return prisma.featuredCollection.create({ data });
  }
  update(
    id: string,
    data: Parameters<typeof prisma.featuredCollection.update>[0]['data'],
  ) {
    return prisma.featuredCollection.update({ where: { id }, data });
  }
  delete(id: string) {
    return prisma.featuredCollection.delete({ where: { id } });
  }
}
