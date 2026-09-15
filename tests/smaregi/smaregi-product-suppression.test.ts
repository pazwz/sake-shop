import assert from 'node:assert/strict';
import test from 'node:test';
import { SyncLogItemType } from '@prisma/client';
import { SmaregiSyncLogItemService } from '@/services/smaregi/smaregi-sync-log-item.service';
import { buildValidatedSmaregiSyncPlan } from '@/services/smaregi/smaregi-sync-plan.service';
import type { SmaregiDryRunResult } from '@/types/smaregi-dry-run';
import type { ValidatedSmaregiSyncPlan } from '@/types/smaregi-sync-plan';

const product = {
  productId: '100',
  categoryId: '10',
  productCode: 'CODE-100',
  productName: 'Offline product',
  price: '3000',
  displayFlag: '1',
  salesDivision: '0',
  division: '0',
  taxDivision: '0' as const,
  useCategoryReduceTax: '1' as const,
  reduceTaxId: null,
};

const inputs = (suppressedSmaregiProductIds?: ReadonlySet<string>) => ({
  targetDate: '2026-09-16',
  syncedAt: new Date('2026-09-16T00:00:00.000Z'),
  stores: [
    { storeId: '1', storeName: 'リンクサス福岡' },
    { storeId: '2', storeName: '倉庫４階' },
    { storeId: '3', storeName: '倉庫2階' },
    { storeId: '6', storeName: '別倉庫' },
  ],
  categories: [
    {
      categoryId: '10',
      categoryCode: 'SAKE',
      categoryName: '日本酒',
      displaySequence: '1',
      displayFlag: '1',
      parentCategoryId: null,
      taxDivision: '0' as const,
      reduceTaxId: null,
    },
  ],
  products: [product],
  stock: [
    {
      storeId: '1',
      productId: '100',
      stockAmount: '5',
      layawayStockAmount: '0',
    },
  ],
  standardTaxRates: [
    {
      applyStartDate: '2019-10-01',
      taxRate: '10',
      taxRounding: '1' as const,
    },
  ],
  reduceTaxRates: [],
  suppressedSmaregiProductIds,
});

test('suppressed product remains in raw source but is excluded from Product and Inventory plans', () => {
  const plan = buildValidatedSmaregiSyncPlan(inputs(new Set(['100'])));
  assert.deepEqual(plan.suppressedProducts, [
    {
      smaregiProductId: '100',
      productCode: 'CODE-100',
      productName: 'Offline product',
    },
  ]);
  assert.equal(plan.products.length, 0);
  assert.equal(plan.inventory.length, 0);
  assert.equal(plan.approvedDeferredProducts.length, 0);
  assert.equal(plan.quarantinedProducts.length, 0);
  assert.equal(plan.warnings.orphanStock.length, 0);
});

test('suppression identity is smaregiProductId and survives a productCode change', () => {
  const renamed = {
    ...inputs(new Set(['100'])),
    products: [{ ...product, productCode: 'CHANGED-CODE' }],
  };
  const plan = buildValidatedSmaregiSyncPlan(renamed);
  assert.equal(plan.suppressedProducts[0]?.productCode, 'CHANGED-CODE');
  assert.equal(plan.products.length, 0);
});

const emptyComparison = (): SmaregiDryRunResult => ({
  storesUsed: [],
  anomalies: {
    missingApprovedStoreIds: [],
    orphanStockCount: 0,
    orphanStock: [],
    negativeStockCount: 0,
    negativeStock: [],
  },
  categories: { toCreate: [], toUpdate: [], unchanged: [], toDeactivate: [] },
  products: {
    toCreate: [],
    toUpdate: [],
    unchanged: [],
    toDeactivate: [],
    approvedDeferredProducts: [],
    blocked: [],
  },
  inventory: { toCreate: [], toUpdate: [], toZero: [], unchanged: [] },
});

test('unchanged suppression does not create repeated detail items', () => {
  const plan: ValidatedSmaregiSyncPlan = {
    ...buildValidatedSmaregiSyncPlan(inputs(new Set(['100']))),
  };
  const items = new SmaregiSyncLogItemService().build({
    plan,
    comparison: emptyComparison(),
    writeResult: {
      categories: 1,
      products: 0,
      inventory: 0,
      reconciliation: {
        deletedProductCount: 0,
        retiredProductCount: 0,
        deletedImages: [],
        events: [],
      },
      suppression: {
        deletedProductCount: 0,
        retiredProductCount: 0,
        deletedImages: [],
        events: [],
      },
    },
    storeNames: new Map(),
  });
  assert.equal(items.length, 0);
});

test('only changed fields and inventory before/after are stored in detail items', () => {
  const comparison = emptyComparison();
  comparison.products.toUpdate.push({
    smaregiProductId: '100',
    productCode: 'CODE-100',
    changes: [{ field: 'price', before: '3000', after: '3500' }],
    taxDivision: '0',
    resolvedTaxRate: '10',
    priceMeaning: 'taxIncluded',
    taxResolutionSource: 'category.standard',
  });
  comparison.inventory.toUpdate.push({
    smaregiProductId: '100',
    productCode: 'CODE-100',
    storeId: '1',
    quantity: { before: 5, after: 3 },
    reservedQuantity: { preserved: 0 },
    layawayStockAmount: 0,
  });
  const plan = buildValidatedSmaregiSyncPlan(inputs());
  const items = new SmaregiSyncLogItemService().build({
    plan,
    comparison,
    writeResult: {
      categories: 1,
      products: 1,
      inventory: 4,
      reconciliation: { deletedProductCount: 0, retiredProductCount: 0, deletedImages: [], events: [] },
      suppression: { deletedProductCount: 0, retiredProductCount: 0, deletedImages: [], events: [] },
    },
    storeNames: new Map([['1', 'リンクサス福岡']]),
  });
  assert.deepEqual(items[0], {
    type: SyncLogItemType.PRODUCT_UPDATED,
    smaregiProductId: '100',
    productCode: 'CODE-100',
    productName: 'Offline product',
    changes: { price: { from: '3000', to: '3500' } },
  });
  assert.equal(items[1]?.type, SyncLogItemType.INVENTORY_UPDATED);
  assert.deepEqual(items[1]?.changes, { quantity: { before: 5, after: 3 } });
});
