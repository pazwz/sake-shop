import { prisma } from '@/lib/prisma';

export class InventoryMirrorRepository {
  public async findById(id: string) {
    return prisma.inventoryMirror.findUnique({ where: { id } });
  }

  public async findByProductId(productId: string) {
    return prisma.inventoryMirror.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async findByProductSlug(slug: string) {
    return prisma.inventoryMirror.findMany({
      where: { product: { slug } },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async findMany() {
    return prisma.inventoryMirror.findMany({ orderBy: { createdAt: 'desc' } });
  }

  public async findByCategory(category: string) {
    return prisma.inventoryMirror.findMany({
      where: {
        product: {
          category: {
            OR: [
              { slug: category },
              { name: category },
              { parent: { slug: category } },
              { parent: { name: category } },
            ],
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findActive() {
    return prisma.inventoryMirror.findMany({
      where: { availableQuantity: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
