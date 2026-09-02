import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { toExternalSlug } from '@/lib/slug';
import {
  calculateAvailableQuantity,
  mapSmaregiCategory,
  mapSmaregiProductCreate,
  mapSmaregiProductUpdate,
} from '@/services/smaregi/smaregi-mapper';
import type { SmaregiCategory } from '@/types/smaregi';
import type { ValidatedSmaregiSyncPlan } from '@/types/smaregi-sync-plan';

type TransactionDatabase = {
  $transaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
};

const SMAREGI_ATOMIC_TRANSACTION_MAX_WAIT_MS = 10_000;
const SMAREGI_ATOMIC_TRANSACTION_TIMEOUT_MS = 300_000;

export class SmaregiAtomicSyncRepository {
  public constructor(private readonly database: TransactionDatabase = prisma) {}

  public applyValidatedPlan(plan: ValidatedSmaregiSyncPlan) {
    return this.database.$transaction(
      async (transaction) => {
        const categoryIds = new Map<string, string>();
        for (const category of this.sortCategories(plan.categories)) {
          const parentId = category.parentCategoryId
            ? categoryIds.get(category.parentCategoryId)
            : null;
          if (category.parentCategoryId && !parentId)
            throw new Error(
              `Smaregi parent category ${category.parentCategoryId} is missing.`,
            );
          const mapped = mapSmaregiCategory(category, parentId ?? null);
          const saved = await transaction.category.upsert({
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
          categoryIds.set(category.categoryId, saved.id);
        }

        const productIds = new Map<string, string>();
        for (const item of plan.products) {
          const categoryId = categoryIds.get(item.product.categoryId);
          if (!categoryId)
            throw new Error(
              `Smaregi category ${item.product.categoryId} is missing.`,
            );
          const saved = await transaction.product.upsert({
            where: { smaregiProductId: item.product.productId },
            create: mapSmaregiProductCreate(
              item.product,
              categoryId,
              item.resolvedTaxRate,
              plan.syncedAt,
            ),
            update: mapSmaregiProductUpdate(
              item.product,
              categoryId,
              plan.syncedAt,
            ),
          });
          productIds.set(item.product.productId, saved.id);
        }

        const existingInventory = await transaction.inventoryMirror.findMany({
          where: {
            productId: { in: [...productIds.values()] },
            smaregiStoreId: { in: plan.storesUsed },
          },
          select: {
            productId: true,
            smaregiStoreId: true,
            reservedQuantity: true,
          },
        });
        const existingInventoryByKey = new Map(
          existingInventory.map((item) => [
            this.inventoryKey(item.productId, item.smaregiStoreId),
            item,
          ]),
        );
        const inventoryToCreate: Prisma.InventoryMirrorCreateManyInput[] = [];
        for (const item of plan.inventory) {
          const productId = productIds.get(item.smaregiProductId);
          if (!productId)
            throw new Error(
              `Smaregi product ${item.smaregiProductId} is missing.`,
            );
          const existing = existingInventoryByKey.get(
            this.inventoryKey(productId, item.smaregiStoreId),
          );
          const reservedQuantity = existing?.reservedQuantity ?? 0;
          if (!existing) {
            inventoryToCreate.push({
              productId,
              smaregiStoreId: item.smaregiStoreId,
              quantity: item.quantity,
              reservedQuantity,
              availableQuantity: calculateAvailableQuantity(
                item.quantity,
                reservedQuantity,
              ),
              lastSyncedAt: plan.syncedAt,
            });
            continue;
          }
          await transaction.inventoryMirror.update({
            where: {
              productId_smaregiStoreId: {
                productId,
                smaregiStoreId: item.smaregiStoreId,
              },
            },
            data: {
              quantity: item.quantity,
              availableQuantity: calculateAvailableQuantity(
                item.quantity,
                reservedQuantity,
              ),
              lastSyncedAt: plan.syncedAt,
            },
          });
        }
        if (inventoryToCreate.length > 0)
          await transaction.inventoryMirror.createMany({
            data: inventoryToCreate,
          });

        return {
          categories: plan.categories.length,
          products: plan.products.length,
          inventory: plan.inventory.length,
        };
      },
      {
        maxWait: SMAREGI_ATOMIC_TRANSACTION_MAX_WAIT_MS,
        timeout: SMAREGI_ATOMIC_TRANSACTION_TIMEOUT_MS,
      },
    );
  }

  private inventoryKey(productId: string, storeId: string) {
    return `${productId}\u0000${storeId}`;
  }

  private sortCategories(categories: SmaregiCategory[]) {
    const byId = new Map(
      categories.map((category) => [category.categoryId, category]),
    );
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const sorted: SmaregiCategory[] = [];
    const visit = (category: SmaregiCategory) => {
      if (visited.has(category.categoryId)) return;
      if (visiting.has(category.categoryId))
        throw new Error('Smaregi category hierarchy contains a cycle.');
      visiting.add(category.categoryId);
      if (category.parentCategoryId) {
        const parent = byId.get(category.parentCategoryId);
        if (!parent)
          throw new Error(
            `Smaregi parent category ${category.parentCategoryId} is missing.`,
          );
        visit(parent);
      }
      visiting.delete(category.categoryId);
      visited.add(category.categoryId);
      sorted.push(category);
    };
    categories.forEach(visit);
    return sorted;
  }
}
