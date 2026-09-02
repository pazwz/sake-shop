import { prisma } from '@/lib/prisma';
import { toExternalSlug } from '@/lib/slug';
import {
  calculateAvailableQuantity,
  mapSmaregiCategory,
  mapSmaregiProductCreate,
  mapSmaregiProductUpdate,
} from '@/services/smaregi/smaregi-mapper';
import type {
  SmaregiCategory,
  SmaregiProduct,
  SmaregiStock,
} from '@/types/smaregi';

export class SmaregiSyncRepository {
  public upsertCategory(category: SmaregiCategory, parentId: string | null) {
    const mapped = mapSmaregiCategory(category, parentId);
    return prisma.category.upsert({
      where: { smaregiCategoryId: category.categoryId },
      create: {
        smaregiCategoryId: category.categoryId,
        name: mapped.name,
        slug: toExternalSlug(
          'smaregi-category',
          category.categoryCode,
          category.categoryId,
        ),
        displayOrder: mapped.displayOrder,
        isActive: mapped.isActive,
        parentId: mapped.parentId,
      },
      update: mapped,
    });
  }

  public findCategoryBySmaregiId(smaregiCategoryId: string) {
    return prisma.category.findUnique({ where: { smaregiCategoryId } });
  }

  public async upsertProduct(
    product: SmaregiProduct,
    categoryId: string,
    taxRate: string,
  ) {
    const existing = await prisma.product.findUnique({
      where: { smaregiProductId: product.productId },
      select: { id: true },
    });
    const saved = await prisma.product.upsert({
      where: { smaregiProductId: product.productId },
      create: mapSmaregiProductCreate(product, categoryId, taxRate),
      update: mapSmaregiProductUpdate(product, categoryId),
    });
    return { product: saved, created: existing === null };
  }

  public findProductBySmaregiId(smaregiProductId: string) {
    return prisma.product.findUnique({ where: { smaregiProductId } });
  }

  public async upsertInventory(
    productId: string,
    storeId: string,
    stock: SmaregiStock,
  ) {
    return prisma.$transaction(async (transaction) => {
      const existing = await transaction.inventoryMirror.findUnique({
        where: {
          productId_smaregiStoreId: {
            productId,
            smaregiStoreId: storeId,
          },
        },
      });
      const quantity = Number(stock.stockAmount);
      const reservedQuantity = existing?.reservedQuantity ?? 0;
      const inventory = await transaction.inventoryMirror.upsert({
        where: {
          productId_smaregiStoreId: {
            productId,
            smaregiStoreId: storeId,
          },
        },
        create: {
          productId,
          smaregiStoreId: storeId,
          quantity,
          reservedQuantity,
          availableQuantity: calculateAvailableQuantity(
            quantity,
            reservedQuantity,
          ),
          lastSyncedAt: new Date(),
        },
        update: {
          quantity,
          availableQuantity: calculateAvailableQuantity(
            quantity,
            reservedQuantity,
          ),
          lastSyncedAt: new Date(),
        },
      });
      return { inventory, created: existing === null };
    });
  }
}
