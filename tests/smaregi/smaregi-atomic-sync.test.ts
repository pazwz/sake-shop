import assert from 'node:assert/strict';
import test from 'node:test';
import { SmaregiAtomicSyncRepository } from '@/repositories/smaregi-atomic-sync.repository';
import { MockSmaregiClient } from '@/services/smaregi/mock-smaregi-client';
import { SmaregiAtomicSyncService } from '@/services/smaregi/smaregi-atomic-sync.service';
import { buildValidatedSmaregiSyncPlan } from '@/services/smaregi/smaregi-sync-plan.service';
import type { ValidatedSmaregiSyncPlan } from '@/types/smaregi-sync-plan';

const plan: ValidatedSmaregiSyncPlan = {
  syncedAt: new Date('2026-08-27T00:00:00.000Z'),
  storesUsed: ['1'],
  warnings: { orphanStock: [], negativeStock: [] },
  categories: [
    {
      categoryId: '10',
      categoryCode: 'SAKE',
      categoryName: '日本酒',
      displaySequence: '1',
      displayFlag: '1',
      parentCategoryId: null,
      taxDivision: '0',
      reduceTaxId: null,
    },
  ],
  approvedDeferredProducts: [],
  products: [
    {
      product: {
        productId: '100',
        categoryId: '10',
        productCode: 'S-100',
        productName: '同期商品',
        price: '3000',
        displayFlag: '1',
        salesDivision: '0',
        division: '0',
        taxDivision: '0',
        useCategoryReduceTax: '1',
        reduceTaxId: null,
      },
      resolvedTaxRate: '10.00',
    },
  ],
  inventory: [
    {
      smaregiProductId: '100',
      smaregiStoreId: '1',
      quantity: 5,
    },
  ],
};

const fakeDatabase = (failAt: 'none' | 'product' | 'inventory') => {
  const committed: string[] = [];
  return {
    committed,
    async $transaction(operation: (transaction: unknown) => Promise<unknown>) {
      const staged: string[] = [];
      const transaction = {
        category: {
          async upsert() {
            staged.push('category');
            return { id: 'local-category' };
          },
        },
        product: {
          async upsert() {
            staged.push('product');
            if (failAt === 'product') throw new Error('product failed');
            return { id: 'local-product' };
          },
        },
        inventoryMirror: {
          async findMany() {
            return [];
          },
          async createMany() {
            staged.push('inventory');
            if (failAt === 'inventory') throw new Error('inventory failed');
            return { count: 1 };
          },
          async update() {
            staged.push('inventory');
            if (failAt === 'inventory') throw new Error('inventory failed');
            return { id: 'local-inventory' };
          },
        },
      };
      const result = await operation(transaction);
      committed.push(...staged);
      return result;
    },
  };
};

test('writes Category, Product, and Inventory in one ordered transaction', async () => {
  const database = fakeDatabase('none');
  const repository = new SmaregiAtomicSyncRepository(database as never);

  const result = await repository.applyValidatedPlan(plan);

  assert.deepEqual(database.committed, ['category', 'product', 'inventory']);
  assert.deepEqual(result, { categories: 1, products: 1, inventory: 1 });
});

test('rolls back all staged writes when Product or Inventory fails', async () => {
  for (const failAt of ['product', 'inventory'] as const) {
    const database = fakeDatabase(failAt);
    const repository = new SmaregiAtomicSyncRepository(database as never);

    await assert.rejects(() => repository.applyValidatedPlan(plan));
    assert.deepEqual(database.committed, []);
  }
});

test('fetches and validates all Smaregi data before invoking persistence', async () => {
  const persistence: {
    applied?: ValidatedSmaregiSyncPlan;
    applyValidatedPlan(
      validatedPlan: ValidatedSmaregiSyncPlan,
    ): Promise<{ categories: number; products: number; inventory: number }>;
  } = {
    async applyValidatedPlan(validatedPlan) {
      this.applied = validatedPlan;
      return { categories: 1, products: 1, inventory: 1 };
    },
  };
  const service = new SmaregiAtomicSyncService(
    new MockSmaregiClient({
      stores: [{ storeId: '1' }],
      categories: plan.categories,
      products: plan.products.map((item) => item.product),
      stock: [
        {
          storeId: '1',
          productId: '100',
          stockAmount: '5',
          layawayStockAmount: '0',
        },
      ],
      consumptionTaxRates: [
        {
          applyStartDate: '2019-10-01',
          taxRate: '10.000',
          taxRounding: '1',
        },
      ],
    }),
    persistence,
  );

  const approvedPlan = await service.prepareValidatedPlan('2026-08-27');
  await service.executeApprovedSync(approvedPlan);

  assert.equal(persistence.applied?.products[0].resolvedTaxRate, '10.00');
  assert.equal(persistence.applied?.inventory[0].quantity, 5);
});

test('excludes approved deferred box products and their inventory from the atomic plan', () => {
  const deferredProduct = {
    ...plan.products[0].product,
    productId: '8000575',
    productCode: '49001777016324',
    productName: '響JH 箱代金',
    categoryId: '8000014',
  };
  const result = buildValidatedSmaregiSyncPlan({
    targetDate: '2026-08-27',
    syncedAt: plan.syncedAt,
    stores: [{ storeId: '1' }],
    categories: [
      ...plan.categories,
      {
        ...plan.categories[0],
        categoryId: '8000014',
        categoryName: '箱',
        taxDivision: null,
      },
    ],
    products: [plan.products[0].product, deferredProduct],
    stock: [
      {
        storeId: '1',
        productId: '100',
        stockAmount: '5',
        layawayStockAmount: '0',
      },
      {
        storeId: '1',
        productId: '8000575',
        stockAmount: '-20',
        layawayStockAmount: '0',
      },
    ],
    standardTaxRates: [
      {
        applyStartDate: '2019-10-01',
        taxRate: '10.000',
        taxRounding: '1',
      },
    ],
    reduceTaxRates: [],
  });

  assert.deepEqual(
    result.products.map((item) => item.product.productId),
    ['100'],
  );
  assert.deepEqual(
    result.inventory.map((item) => item.smaregiProductId),
    ['100'],
  );
  assert.deepEqual(result.approvedDeferredProducts, [
    {
      smaregiProductId: '8000575',
      productCode: '49001777016324',
      productName: '響JH 箱代金',
      code: 'CATEGORY_TAX_DIVISION_MISSING',
    },
  ]);
  assert.equal(result.warnings.negativeStock.length, 1);
});

test('keeps unapproved tax failures fail closed in the atomic plan', () => {
  assert.throws(() =>
    buildValidatedSmaregiSyncPlan({
      targetDate: '2026-08-27',
      syncedAt: plan.syncedAt,
      stores: [{ storeId: '1' }],
      categories: [{ ...plan.categories[0], taxDivision: null }],
      products: [plan.products[0].product],
      stock: [],
      standardTaxRates: [],
      reduceTaxRates: [],
    }),
  );
});
