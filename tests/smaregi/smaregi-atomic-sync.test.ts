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
  quarantinedProducts: [],
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

test('applies the same plan twice without duplicating product or inventory identity', async () => {
  const categories = new Map<string, { id: string }>();
  const products = new Map<string, { id: string }>();
  const inventory = new Map<
    string,
    { productId: string; smaregiStoreId: string; reservedQuantity: number }
  >();
  const database = {
    async $transaction(operation: (transaction: unknown) => Promise<unknown>) {
      return operation({
        category: {
          async upsert(input: { where: { smaregiCategoryId: string } }) {
            const key = input.where.smaregiCategoryId;
            const saved = categories.get(key) ?? { id: 'local-category' };
            categories.set(key, saved);
            return saved;
          },
        },
        product: {
          async upsert(input: { where: { smaregiProductId: string } }) {
            const key = input.where.smaregiProductId;
            const saved = products.get(key) ?? { id: 'local-product' };
            products.set(key, saved);
            return saved;
          },
        },
        inventoryMirror: {
          async findMany() {
            return [...inventory.values()];
          },
          async createMany(input: {
            data: Array<{
              productId: string;
              smaregiStoreId: string;
              reservedQuantity: number;
            }>;
          }) {
            for (const item of input.data) {
              inventory.set(`${item.productId}:${item.smaregiStoreId}`, item);
            }
            return { count: input.data.length };
          },
          async update() {
            return { id: 'local-inventory' };
          },
        },
      });
    },
  };
  const repository = new SmaregiAtomicSyncRepository(database as never);

  await repository.applyValidatedPlan(plan);
  await repository.applyValidatedPlan(plan);

  assert.equal(categories.size, 1);
  assert.equal(products.size, 1);
  assert.equal(inventory.size, 1);
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

test('keeps an approved deferred box out of writes after its tax becomes resolvable', () => {
  const deferredProduct = {
    ...plan.products[0].product,
    productId: '8000575',
    productCode: '49001777016324',
    productName: '響JH 箱代金',
  };
  const result = buildValidatedSmaregiSyncPlan({
    targetDate: '2026-08-27',
    syncedAt: plan.syncedAt,
    stores: [{ storeId: '1' }],
    categories: plan.categories,
    products: [deferredProduct],
    stock: [
      {
        storeId: '1',
        productId: '8000575',
        stockAmount: '2',
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

  assert.equal(result.products.length, 0);
  assert.equal(result.inventory.length, 0);
  assert.deepEqual(result.approvedDeferredProducts, [
    {
      smaregiProductId: '8000575',
      productCode: '49001777016324',
      productName: '響JH 箱代金',
      code: 'DEFERRED_NOW_RESOLVABLE',
    },
  ]);
});

test('quarantines an unapproved product tax failure while keeping other products safe', () => {
  const safeCategory = {
    ...plan.categories[0],
    categoryId: '11',
    categoryCode: 'SAFE',
  };
  const safeProduct = {
    ...plan.products[0].product,
    productId: '101',
    productCode: 'S-101',
    categoryId: '11',
  };
  const result = buildValidatedSmaregiSyncPlan({
    targetDate: '2026-08-27',
    syncedAt: plan.syncedAt,
    stores: [{ storeId: '1' }],
    categories: [{ ...plan.categories[0], taxDivision: null }, safeCategory],
    products: [plan.products[0].product, safeProduct],
    stock: [],
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
    ['101'],
  );
  assert.equal(result.inventory.length, 1);
  assert.deepEqual(result.quarantinedProducts, [
    {
      smaregiProductId: '100',
      productCode: 'S-100',
      reasonCode: 'CATEGORY_TAX_DIVISION_MISSING',
      message: 'Smaregi tax resolution blocked: CATEGORY_TAX_DIVISION_MISSING.',
    },
  ]);
});
