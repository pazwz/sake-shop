import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminRole } from '@prisma/client';
import { SmaregiProductionSyncLockRepository } from '@/repositories/smaregi-production-sync-lock.repository';
import { MockSmaregiClient } from '@/services/smaregi/mock-smaregi-client';
import { ProductionSmaregiSyncService } from '@/services/smaregi/production-smaregi-sync.service';
import { SmaregiProductionValidationService } from '@/services/smaregi/smaregi-production-validation.service';
import {
  assertCronAuthorization,
  assertSmaregiSyncAdminRole,
  requireAvailableManualSync,
} from '@/services/smaregi/smaregi-sync-access.service';
import { buildValidatedSmaregiSyncPlan } from '@/services/smaregi/smaregi-sync-plan.service';
import type { SmaregiDryRunSnapshot } from '@/types/smaregi-dry-run';
import type { ValidatedSmaregiSyncPlan } from '@/types/smaregi-sync-plan';

const stores = ['1', '2', '3', '6'].map((storeId) => ({
  storeId,
  storeName: `Store ${storeId}`,
}));
const category = {
  categoryId: '10',
  categoryCode: 'SAKE',
  categoryName: '日本酒',
  displaySequence: '1',
  displayFlag: '1',
  parentCategoryId: null,
  taxDivision: '0' as const,
  reduceTaxId: null,
};
const product = {
  productId: '100',
  categoryId: '10',
  productCode: 'S-100',
  productName: '通常商品',
  price: '3000',
  displayFlag: '1',
  salesDivision: '0',
  division: '0',
  taxDivision: '0' as const,
  useCategoryReduceTax: '1' as const,
  reduceTaxId: null,
};
const standardTaxRates = [
  {
    applyStartDate: '2019-10-01',
    taxRate: '10.000',
    taxRounding: '1' as const,
  },
];
const stock = stores.map(({ storeId }, index) => ({
  storeId,
  productId: product.productId,
  stockAmount: String(index + 1),
  layawayStockAmount: '0',
}));
const emptySnapshot: SmaregiDryRunSnapshot = {
  categories: [],
  products: [],
  inventory: [],
};

const createHarness = (options?: {
  acquired?: boolean;
  data?: ConstructorParameters<typeof MockSmaregiClient>[0];
  snapshot?: SmaregiDryRunSnapshot;
}) => {
  const applied: ValidatedSmaregiSyncPlan[] = [];
  const succeeded: unknown[] = [];
  const failed: unknown[] = [];
  const service = new ProductionSmaregiSyncService(
    new MockSmaregiClient({
      stores,
      categories: [category],
      products: [product],
      stock,
      consumptionTaxRates: standardTaxRates,
      ...options?.data,
    }),
    {
      async executeApprovedSync(plan) {
        applied.push(plan);
        return { categories: 1, products: 1, inventory: 4 };
      },
    },
    {
      async withLock(operation) {
        return options?.acquired === false
          ? { acquired: false as const }
          : { acquired: true as const, value: await operation() };
      },
    },
    {
      async start() {
        return { id: 'log-1' } as never;
      },
      async succeed(_id, payload) {
        succeeded.push(payload);
        return {} as never;
      },
      async fail(_id, error, _retry, payload) {
        failed.push({ error, payload });
        return {} as never;
      },
    },
    {
      async getSnapshot() {
        return options?.snapshot ?? emptySnapshot;
      },
    },
  );
  return { service, applied, succeeded, failed };
};

test('accepts only OWNER/MANAGER for manual synchronization', () => {
  assert.doesNotThrow(() => assertSmaregiSyncAdminRole(AdminRole.OWNER));
  assert.doesNotThrow(() => assertSmaregiSyncAdminRole(AdminRole.MANAGER));
  assert.throws(
    () => assertSmaregiSyncAdminRole(AdminRole.STAFF),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 403,
  );
});

test('rejects missing or incorrect CRON_SECRET and accepts an exact bearer token', () => {
  for (const authorization of [null, 'Bearer wrong']) {
    assert.throws(
      () => assertCronAuthorization(authorization, 'secret'),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        error.statusCode === 401,
    );
  }
  assert.doesNotThrow(() => assertCronAuthorization('Bearer secret', 'secret'));
});

test('maps an occupied manual synchronization lock to HTTP 409 semantics', () => {
  assert.throws(
    () =>
      requireAvailableManualSync({
        trigger: 'ADMIN',
        outcome: 'SKIPPED_ALREADY_RUNNING',
        startedAt: '2026-09-03T00:00:00.000Z',
        finishedAt: '2026-09-03T00:00:01.000Z',
        sourceProductCount: 0,
        sourceStockCount: 0,
        productsCreated: 0,
        productsUpdated: 0,
        productsUnchanged: 0,
        productsDeferred: 0,
        productsQuarantined: 0,
        inventoryCreated: 0,
        inventoryUpdated: 0,
        inventoryZeroed: 0,
        inventoryUnchanged: 0,
        orphanCount: 0,
        knownOrphanCount: 0,
        newOrphanCount: 0,
        negativeCount: 0,
        warningsCount: 0,
        errorCode: 'SYNC_ALREADY_RUNNING',
        errorSummary: 'Another production Smaregi sync is already running.',
      }),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 409,
  );
});

test('runs the prepared plan through the atomic sync entry exactly once', async () => {
  const harness = createHarness();
  const result = await harness.service.run('ADMIN');

  assert.equal(result.outcome, 'SUCCESS');
  assert.equal(harness.applied.length, 1);
  assert.equal(harness.applied[0].products.length, 1);
  assert.equal(harness.applied[0].inventory.length, 4);
  assert.equal(harness.succeeded.length, 1);
  assert.equal(harness.failed.length, 0);
});

test('classifies safe name, stock increase/decrease, explicit zero, and missing stock changes', async () => {
  const harness = createHarness({
    data: {
      stock: [
        { ...stock[0], stockAmount: '1' },
        { ...stock[1], stockAmount: '2' },
        { ...stock[2], stockAmount: '0' },
      ],
    },
    snapshot: {
      categories: [
        {
          id: 'local-category',
          smaregiCategoryId: '10',
          parentId: null,
          name: '日本酒',
          displayOrder: 1,
          isActive: true,
        },
      ],
      products: [
        {
          id: 'local-product',
          smaregiProductId: '100',
          categoryId: 'local-category',
          productCode: 'S-100',
          name: '旧商品名',
          price: '3000',
          isActive: true,
        },
      ],
      inventory: [
        {
          productId: 'local-product',
          smaregiStoreId: '1',
          quantity: 0,
          reservedQuantity: 0,
        },
        {
          productId: 'local-product',
          smaregiStoreId: '2',
          quantity: 5,
          reservedQuantity: 0,
        },
        {
          productId: 'local-product',
          smaregiStoreId: '3',
          quantity: 3,
          reservedQuantity: 0,
        },
        {
          productId: 'local-product',
          smaregiStoreId: '6',
          quantity: 4,
          reservedQuantity: 0,
        },
      ],
    },
  });

  const result = await harness.service.run('ADMIN');
  assert.equal(result.outcome, 'SUCCESS');
  assert.equal(result.productsUpdated, 1);
  assert.equal(result.inventoryUpdated, 2);
  assert.equal(result.inventoryZeroed, 2);
});

test('skips without invoking atomic persistence when the global lock is occupied', async () => {
  const harness = createHarness({ acquired: false });
  const result = await harness.service.run('CRON');

  assert.equal(result.outcome, 'SKIPPED_ALREADY_RUNNING');
  assert.equal(harness.applied.length, 0);
  assert.equal(harness.succeeded.length, 1);
});

test('distinguishes known and new orphan stock without blocking safe data', async () => {
  const harness = createHarness({
    data: {
      stock: [
        ...stock,
        {
          storeId: '1',
          productId: '8000301',
          stockAmount: '1',
          layawayStockAmount: '0',
        },
        {
          storeId: '1',
          productId: 'new-orphan',
          stockAmount: '1',
          layawayStockAmount: '0',
        },
      ],
    },
  });

  const result = await harness.service.run('CRON');
  assert.equal(result.outcome, 'SUCCESS_WITH_WARNINGS');
  assert.equal(result.knownOrphanCount, 1);
  assert.equal(result.newOrphanCount, 1);
  assert.equal(harness.applied[0].products.length, 1);
  assert.equal(harness.applied[0].inventory.length, 4);
});

test('treats unknown stores and duplicate product identity as fatal anomalies', () => {
  const validation = new SmaregiProductionValidationService();
  const base = {
    targetDate: '2026-09-03',
    stores,
    categories: [category],
    products: [product],
    stock,
    standardTaxRates,
  };
  assert.throws(
    () =>
      validation.validateSource({
        ...base,
        stores: [...stores, { storeId: '9' }],
      }),
    { code: 'SMAREGI_FATAL_SOURCE_ANOMALY' },
  );
  assert.throws(
    () => validation.validateSource({ ...base, products: [product, product] }),
    { code: 'SMAREGI_FATAL_SOURCE_ANOMALY' },
  );
  assert.throws(
    () =>
      validation.validateSource({
        ...base,
        products: [product, { ...product, productId: '101' }],
      }),
    { code: 'SMAREGI_FATAL_SOURCE_ANOMALY' },
  );
});

test('performs zero atomic writes and records failure for a fatal source anomaly', async () => {
  const harness = createHarness({
    data: { stores: [...stores, { storeId: '9' }] },
  });

  await assert.rejects(() => harness.service.run('CRON'), {
    code: 'SMAREGI_FATAL_SOURCE_ANOMALY',
  });
  assert.equal(harness.applied.length, 0);
  assert.equal(harness.succeeded.length, 0);
  assert.equal(harness.failed.length, 1);
});

test('treats a Neon snapshot product identity conflict as fatal with zero writes', async () => {
  const harness = createHarness({
    snapshot: {
      categories: [],
      products: [
        {
          id: 'conflict',
          smaregiProductId: '999',
          categoryId: 'local-category',
          productCode: 'S-100',
          name: 'conflicting product',
          price: '1',
          isActive: true,
        },
      ],
      inventory: [],
    },
  });

  await assert.rejects(() => harness.service.run('CRON'), {
    code: 'SMAREGI_FATAL_SOURCE_ANOMALY',
  });
  assert.equal(harness.applied.length, 0);
  assert.equal(harness.failed.length, 1);
});

test('quarantines a normal product with negative stock but keeps unrelated products safe', () => {
  const second = {
    ...product,
    productId: '101',
    productCode: 'S-101',
    productName: '安全商品',
  };
  const plan = buildValidatedSmaregiSyncPlan({
    targetDate: '2026-09-03',
    syncedAt: new Date('2026-09-03T00:00:00.000Z'),
    stores,
    categories: [category],
    products: [product, second],
    stock: [
      ...stock.map((item) => ({ ...item, stockAmount: '-1' })),
      ...stores.map(({ storeId }) => ({
        storeId,
        productId: second.productId,
        stockAmount: '2',
        layawayStockAmount: '0',
      })),
      {
        storeId: '1',
        productId: 'orphan-new',
        stockAmount: '3',
        layawayStockAmount: '0',
      },
    ],
    standardTaxRates,
    reduceTaxRates: [],
  });

  assert.deepEqual(
    plan.products.map((item) => item.product.productId),
    ['101'],
  );
  assert.equal(plan.inventory.length, 4);
  assert.equal(
    plan.quarantinedProducts[0]?.reasonCode,
    'NORMAL_PRODUCT_NEGATIVE_STOCK',
  );
  assert.equal(plan.warnings.orphanStock.length, 1);
});

test('allows only one concurrent caller to hold the PostgreSQL advisory lock', async () => {
  let held = false;
  let releaseFirst!: () => void;
  let firstStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    firstStarted = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const database = {
    async $transaction(operation: (transaction: unknown) => Promise<unknown>) {
      let ownsLock = false;
      const transaction = {
        async $queryRaw() {
          const acquired = !held;
          if (acquired) {
            held = true;
            ownsLock = true;
          }
          return [{ acquired }];
        },
      };
      try {
        return await operation(transaction);
      } finally {
        if (ownsLock) held = false;
      }
    },
  };
  const lock = new SmaregiProductionSyncLockRepository(database as never);
  let runs = 0;
  const first = lock.withLock(async () => {
    runs += 1;
    firstStarted();
    await release;
    return 'first';
  });
  await started;
  const second = await lock.withLock(async () => {
    runs += 1;
    return 'second';
  });
  releaseFirst();
  const firstResult = await first;

  assert.deepEqual(second, { acquired: false });
  assert.deepEqual(firstResult, { acquired: true, value: 'first' });
  assert.equal(runs, 1);

  await assert.rejects(() =>
    lock.withLock(async () => {
      throw new Error('operation failed');
    }),
  );
  const afterFailure = await lock.withLock(async () => 'after-failure');
  assert.deepEqual(afterFailure, {
    acquired: true,
    value: 'after-failure',
  });
});
