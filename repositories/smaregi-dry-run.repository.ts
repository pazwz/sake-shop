import { prisma } from '@/lib/prisma';
import type { SmaregiDryRunSnapshot } from '@/types/smaregi-dry-run';

export class SmaregiDryRunRepository {
  public async getSnapshot(): Promise<SmaregiDryRunSnapshot> {
    const [categories, products, inventory] = await Promise.all([
      prisma.category.findMany({
        select: {
          id: true,
          smaregiCategoryId: true,
          parentId: true,
          name: true,
          displayOrder: true,
          isActive: true,
        },
      }),
      prisma.product.findMany({
        select: {
          id: true,
          smaregiProductId: true,
          categoryId: true,
          productCode: true,
          name: true,
          price: true,
          isActive: true,
        },
      }),
      prisma.inventoryMirror.findMany({
        select: {
          productId: true,
          smaregiStoreId: true,
          quantity: true,
          reservedQuantity: true,
        },
      }),
    ]);

    return {
      categories,
      products: products.map((product) => ({
        ...product,
        price: product.price.toString(),
      })),
      inventory,
    };
  }
}
