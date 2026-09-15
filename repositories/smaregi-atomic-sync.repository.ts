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
import type {
  SmaregiAtomicSyncResult,
  SmaregiMissingProductPlan,
  SmaregiSuppressionWriteResult,
} from '@/types/smaregi-missing-product';

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

  public applyValidatedPlan(
    plan: ValidatedSmaregiSyncPlan,
    missingPlan?: SmaregiMissingProductPlan,
  ): Promise<SmaregiAtomicSyncResult> {
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

        const suppression = await this.reconcileSuppressedProducts(
          transaction,
          plan,
        );
        const reconciliation = await this.reconcileMissingProducts(
          transaction,
          missingPlan,
        );
        return {
          categories: plan.categories.length,
          products: plan.products.length,
          inventory: plan.inventory.length,
          reconciliation,
          suppression,
        };
      },
      {
        maxWait: SMAREGI_ATOMIC_TRANSACTION_MAX_WAIT_MS,
        timeout: SMAREGI_ATOMIC_TRANSACTION_TIMEOUT_MS,
      },
    );
  }

  private async reconcileMissingProducts(
    transaction: Prisma.TransactionClient,
    plan?: SmaregiMissingProductPlan,
  ) {
    const result = {
      deletedProductCount: 0,
      retiredProductCount: 0,
      deletedImages: [] as Array<{
        productId: string;
        smaregiProductId: string;
        imageUrl: string;
      }>,
      events: [] as Array<{
        smaregiProductId: string;
        productCode: string;
        productName: string;
        type: 'PRODUCT_DELETED' | 'PRODUCT_RETIRED' | 'PRODUCT_SUPPRESSED';
        reason: 'MISSING_FROM_SOURCE' | 'OFFLINE_ONLY';
      }>,
    };
    if (!plan || plan.mode === 'report') return result;
    if (!plan.snapshotComplete || plan.sourceProductCount === 0)
      throw new Error(
        'Missing Product reconciliation requires a complete snapshot.',
      );

    const sourceIds = new Set(plan.sourceProductIds);
    for (const candidate of [...plan.retire, ...plan.safeToDelete]) {
      if (sourceIds.has(candidate.smaregiProductId))
        throw new Error(
          'Missing Product plan contains a current source identity.',
        );
      const current = await transaction.product.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          smaregiProductId: true,
          images: { select: { imageUrl: true } },
          boxProductId: true,
          boxedProduct: { select: { id: true } },
          _count: {
            select: {
              orderItems: true,
              inventoryReservations: true,
              featuredCollectionProducts: true,
              editorialSections: true,
            },
          },
        },
      });
      if (!current) continue;
      if (current.smaregiProductId !== candidate.smaregiProductId)
        throw new Error(
          'Missing Product identity changed before reconciliation.',
        );
      const mustRetire =
        candidate.references.orderItems > 0 ||
        candidate.references.reservations > 0 ||
        candidate.references.collections > 0 ||
        candidate.references.editorialSections > 0 ||
        candidate.references.boxRelations > 0 ||
        current._count.orderItems > 0 ||
        current._count.inventoryReservations > 0 ||
        current._count.featuredCollectionProducts > 0 ||
        current._count.editorialSections > 0 ||
        Boolean(current.boxProductId) ||
        Boolean(current.boxedProduct);
      if (mustRetire) {
        await transaction.product.update({
          where: { id: current.id },
          data: { isActive: false, isEcAvailable: false },
        });
        result.retiredProductCount += 1;
        result.events.push({
          smaregiProductId: current.smaregiProductId,
          productCode: candidate.productCode,
          productName: candidate.name,
          type: 'PRODUCT_RETIRED',
          reason: 'MISSING_FROM_SOURCE',
        });
        continue;
      }
      result.deletedImages.push(
        ...current.images.map((image) => ({
          productId: current.id,
          smaregiProductId: current.smaregiProductId,
          imageUrl: image.imageUrl,
        })),
      );
      await transaction.productImage.deleteMany({
        where: { productId: current.id },
      });
      await transaction.inventoryMirror.deleteMany({
        where: { productId: current.id },
      });
      await transaction.product.delete({ where: { id: current.id } });
      result.deletedProductCount += 1;
      result.events.push({
        smaregiProductId: current.smaregiProductId,
        productCode: candidate.productCode,
        productName: candidate.name,
        type: 'PRODUCT_DELETED',
        reason: 'MISSING_FROM_SOURCE',
      });
    }
    return result;
  }

  private async reconcileSuppressedProducts(
    transaction: Prisma.TransactionClient,
    plan: ValidatedSmaregiSyncPlan,
  ): Promise<SmaregiSuppressionWriteResult> {
    const result: SmaregiSuppressionWriteResult = {
      deletedProductCount: 0,
      retiredProductCount: 0,
      deletedImages: [],
      events: [],
    };
    for (const suppressed of plan.suppressedProducts) {
      const current = await transaction.product.findUnique({
        where: { smaregiProductId: suppressed.smaregiProductId },
        select: {
          id: true,
          smaregiProductId: true,
          images: { select: { imageUrl: true } },
          boxProductId: true,
          boxedProduct: { select: { id: true } },
          _count: {
            select: {
              orderItems: true,
              inventoryReservations: true,
              featuredCollectionProducts: true,
              editorialSections: true,
            },
          },
        },
      });
      if (!current) continue;
      const mustRetire =
        current._count.orderItems > 0 ||
        current._count.inventoryReservations > 0 ||
        current._count.featuredCollectionProducts > 0 ||
        current._count.editorialSections > 0 ||
        Boolean(current.boxProductId) ||
        Boolean(current.boxedProduct);
      if (mustRetire) {
        await transaction.product.update({
          where: { id: current.id },
          data: { isActive: false, isEcAvailable: false },
        });
        result.retiredProductCount += 1;
        result.events.push({
          smaregiProductId: current.smaregiProductId,
          productCode: suppressed.productCode,
          productName: suppressed.productName,
          type: 'PRODUCT_SUPPRESSED',
          reason: 'OFFLINE_ONLY',
        });
        continue;
      }
      result.deletedImages.push(
        ...current.images.map((image) => ({
          productId: current.id,
          smaregiProductId: current.smaregiProductId,
          imageUrl: image.imageUrl,
        })),
      );
      await transaction.productImage.deleteMany({
        where: { productId: current.id },
      });
      await transaction.inventoryMirror.deleteMany({
        where: { productId: current.id },
      });
      await transaction.product.delete({ where: { id: current.id } });
      result.deletedProductCount += 1;
      result.events.push({
        smaregiProductId: current.smaregiProductId,
        productCode: suppressed.productCode,
        productName: suppressed.productName,
        type: 'PRODUCT_SUPPRESSED',
        reason: 'OFFLINE_ONLY',
      });
    }
    return result;
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
