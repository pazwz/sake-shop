import { SyncLogItemType } from '@prisma/client';
import type { SyncLogItemInput } from '@/repositories/sync-log-item.repository';
import type { SmaregiAtomicSyncResult } from '@/types/smaregi-missing-product';
import type { SmaregiDryRunResult } from '@/types/smaregi-dry-run';
import type { ValidatedSmaregiSyncPlan } from '@/types/smaregi-sync-plan';

type Input = {
  plan: ValidatedSmaregiSyncPlan;
  comparison: SmaregiDryRunResult;
  writeResult: SmaregiAtomicSyncResult;
  storeNames: ReadonlyMap<string, string | null>;
};

export class SmaregiSyncLogItemService {
  public build(input: Input): SyncLogItemInput[] {
    const items: SyncLogItemInput[] = [];
    const names = new Map<string, string>([
      ...input.plan.products.map(({ product }) => [
        product.productId,
        product.productName,
      ] as const),
      ...input.plan.suppressedProducts.map((product) => [
        product.smaregiProductId,
        product.productName,
      ] as const),
    ]);

    for (const product of input.comparison.products.toCreate) {
      items.push({
        type: SyncLogItemType.PRODUCT_CREATED,
        smaregiProductId: product.smaregiProductId,
        productCode: product.productCode,
        productName: product.name,
      });
    }
    for (const product of [
      ...input.comparison.products.toUpdate,
      ...input.comparison.products.toDeactivate,
    ]) {
      items.push({
        type: SyncLogItemType.PRODUCT_UPDATED,
        smaregiProductId: product.smaregiProductId,
        productCode: product.productCode,
        productName: names.get(product.smaregiProductId) ?? null,
        changes: this.toChangeObject(product.changes),
      });
    }
    this.appendInventory(
      items,
      input.comparison.inventory.toCreate,
      SyncLogItemType.INVENTORY_CREATED,
      names,
      input.storeNames,
    );
    this.appendInventory(
      items,
      input.comparison.inventory.toUpdate,
      SyncLogItemType.INVENTORY_UPDATED,
      names,
      input.storeNames,
    );
    this.appendInventory(
      items,
      input.comparison.inventory.toZero,
      SyncLogItemType.INVENTORY_ZEROED,
      names,
      input.storeNames,
    );
    for (const product of input.plan.approvedDeferredProducts) {
      items.push({
        type: SyncLogItemType.TAX_DEFERRED,
        smaregiProductId: product.smaregiProductId,
        productCode: product.productCode,
        productName: product.productName,
        reason: product.code,
      });
    }
    for (const product of input.plan.quarantinedProducts) {
      items.push({
        type: SyncLogItemType.QUARANTINED,
        smaregiProductId: product.smaregiProductId,
        productCode: product.productCode,
        productName: names.get(product.smaregiProductId) ?? null,
        reason: product.reasonCode,
      });
    }
    for (const warning of input.plan.warnings.orphanStock) {
      items.push({
        type: SyncLogItemType.ORPHAN_INVENTORY,
        smaregiProductId: warning.smaregiProductId,
        productCode: warning.productCode,
        productName: warning.productName,
        storeId: warning.storeId,
        storeName: warning.storeName,
        reason: 'ORPHAN_INVENTORY',
        changes: { quantity: { after: warning.rawStockAmount } },
      });
    }
    for (const warning of input.plan.warnings.negativeStock) {
      items.push({
        type: SyncLogItemType.NEGATIVE_STOCK,
        smaregiProductId: warning.smaregiProductId,
        productCode: warning.productCode,
        productName: warning.productName,
        storeId: warning.storeId,
        storeName: warning.storeName,
        reason: 'NEGATIVE_STOCK',
        changes: { quantity: { after: warning.rawStockAmount } },
      });
    }
    for (const event of [
      ...input.writeResult.reconciliation.events,
      ...input.writeResult.suppression.events,
    ]) {
      items.push({
        type: SyncLogItemType[event.type],
        smaregiProductId: event.smaregiProductId,
        productCode: event.productCode,
        productName: event.productName,
        reason: event.reason,
      });
    }
    return items;
  }

  private appendInventory(
    target: SyncLogItemInput[],
    inventory: SmaregiDryRunResult['inventory']['toCreate'],
    type: SyncLogItemType,
    names: ReadonlyMap<string, string | null>,
    storeNames: ReadonlyMap<string, string | null>,
  ) {
    for (const item of inventory) {
      target.push({
        type,
        smaregiProductId: item.smaregiProductId,
        productCode: item.productCode,
        productName: names.get(item.smaregiProductId) ?? null,
        storeId: item.storeId,
        storeName: storeNames.get(item.storeId) ?? null,
        changes: { quantity: item.quantity },
      });
    }
  }

  private toChangeObject(
    changes: Array<{ field: string; before: string | number | boolean | null; after: string | number | boolean | null }>,
  ) {
    return Object.fromEntries(
      changes.map(({ field, before, after }) => [field, { from: before, to: after }]),
    );
  }
}
