import assert from 'node:assert/strict';
import test from 'node:test';
import { SmaregiAtomicSyncRepository } from '@/repositories/smaregi-atomic-sync.repository';
import type { SmaregiMissingProductRecord } from '@/repositories/smaregi-missing-product.repository';
import {
  mapSmaregiProductCreate,
  mapSmaregiProductUpdate,
} from '@/services/smaregi/smaregi-mapper';
import { SmaregiMissingProductService } from '@/services/smaregi/smaregi-missing-product.service';
import { SmaregiProductImageCleanupService } from '@/services/smaregi/smaregi-product-image-cleanup.service';
import type { SmaregiProductSnapshot } from '@/types/smaregi';
import type { SmaregiMissingProductPlan } from '@/types/smaregi-missing-product';
import type { ValidatedSmaregiSyncPlan } from '@/types/smaregi-sync-plan';

const sourceProduct = {
  productId: '100',
  categoryId: '10',
  productCode: 'S-100',
  productName: 'Current product',
  price: '3000',
  displayFlag: '1',
  salesDivision: '0',
  division: '0',
  taxDivision: '0' as const,
  useCategoryReduceTax: '1' as const,
  reduceTaxId: null,
};

const snapshot = (products = [sourceProduct]): SmaregiProductSnapshot => ({
  products,
  sourceIdentityCount: new Set(products.map((product) => product.productId))
    .size,
  pagesFetched: 1,
  pageSize: 1000,
  complete: true,
});

const missingRecord = (
  overrides: Partial<SmaregiMissingProductRecord> = {},
): SmaregiMissingProductRecord => ({
  id: 'local-101',
  smaregiProductId: '101',
  productCode: 'S-101',
  name: 'Missing product',
  categorySmaregiId: '10',
  boxProductId: null,
  boxedProductId: null,
  imageUrls: ['https://media.example/uploads/101.png'],
  references: {
    orderItems: 0,
    reservations: 0,
    collections: 0,
    editorialSections: 0,
  },
  ...overrides,
});

const missingService = (records: SmaregiMissingProductRecord[]) =>
  new SmaregiMissingProductService({
    async findAbsentFromSource(sourceIds) {
      const current = new Set(sourceIds);
      return records.filter((record) => !current.has(record.smaregiProductId));
    },
  });

test('report identifies source 100 / Neon 101 without mutating data', async () => {
  const plan = await missingService([missingRecord()]).buildPlan(
    snapshot(),
    'report',
  );
  assert.equal(plan.safeToDelete.length, 1);
  assert.equal(plan.retire.length, 0);
  assert.equal(plan.mode, 'report');
});

test('OrderItem, Reservation, Collection, Editorial, and box references require RETIRE', async () => {
  const records = [
    missingRecord({
      id: 'order',
      references: {
        orderItems: 1,
        reservations: 0,
        collections: 0,
        editorialSections: 0,
      },
    }),
    missingRecord({
      id: 'reservation',
      smaregiProductId: '102',
      references: {
        orderItems: 0,
        reservations: 1,
        collections: 0,
        editorialSections: 0,
      },
    }),
    missingRecord({
      id: 'collection',
      smaregiProductId: '103',
      references: {
        orderItems: 0,
        reservations: 0,
        collections: 1,
        editorialSections: 0,
      },
    }),
    missingRecord({
      id: 'editorial',
      smaregiProductId: '104',
      references: {
        orderItems: 0,
        reservations: 0,
        collections: 0,
        editorialSections: 1,
      },
    }),
    missingRecord({
      id: 'box',
      smaregiProductId: '105',
      boxProductId: 'box-id',
    }),
  ];
  const plan = await missingService(records).buildPlan(snapshot(), 'apply');
  assert.equal(plan.retire.length, 5);
  assert.equal(plan.safeToDelete.length, 0);
});

test('raw source identities keep deferred and quarantined products out of missing', async () => {
  const deferred = {
    ...sourceProduct,
    productId: '8000570',
    productCode: 'BOX',
  };
  const quarantined = {
    ...sourceProduct,
    productId: '102',
    productCode: 'Q-102',
  };
  const service = missingService([
    missingRecord({ smaregiProductId: deferred.productId }),
    missingRecord({ smaregiProductId: quarantined.productId }),
  ]);
  const plan = await service.buildPlan(
    snapshot([sourceProduct, deferred, quarantined]),
    'apply',
  );
  assert.equal(plan.safeToDelete.length + plan.retire.length, 0);
});

test('website, package, service, and box-category products are excluded', async () => {
  const plan = await missingService([
    missingRecord({ id: 'website', smaregiProductId: 'linxas-local' }),
    missingRecord({ id: 'package', smaregiProductId: '8000774' }),
    missingRecord({ id: 'service', smaregiProductId: '8000511' }),
    missingRecord({
      id: 'box-category',
      smaregiProductId: '999',
      categorySmaregiId: '8000014',
    }),
  ]).buildPlan(snapshot(), 'apply');
  assert.equal(plan.safeToDelete.length + plan.retire.length, 0);
});

test('empty and duplicate-identity snapshots fail closed', async () => {
  const service = missingService([missingRecord()]);
  await assert.rejects(() => service.buildPlan(snapshot([]), 'apply'), {
    code: 'SMAREGI_PRODUCT_SNAPSHOT_INCOMPLETE',
  });
  const duplicate = snapshot([sourceProduct, sourceProduct]);
  await assert.rejects(() => service.buildPlan(duplicate, 'apply'), {
    code: 'SMAREGI_PRODUCT_SNAPSHOT_IDENTITY_INVALID',
  });
});

const emptySyncPlan: ValidatedSmaregiSyncPlan = {
  syncedAt: new Date('2026-09-15T00:00:00.000Z'),
  storesUsed: [],
  warnings: { orphanStock: [], negativeStock: [] },
  categories: [],
  approvedDeferredProducts: [],
  quarantinedProducts: [],
  products: [],
  inventory: [],
};

const reconciliationPlan = (
  mode: 'report' | 'apply',
  candidate = missingRecord(),
): SmaregiMissingProductPlan => ({
  mode,
  snapshotComplete: true,
  sourceProductCount: 1,
  sourceIdentityCount: 1,
  sourceProductIds: ['100'],
  safeToDelete: [
    {
      id: candidate.id,
      smaregiProductId: candidate.smaregiProductId,
      productCode: candidate.productCode,
      name: candidate.name,
      imageUrls: candidate.imageUrls,
      references: { ...candidate.references, boxRelations: 0 },
    },
  ],
  retire: [],
  blocked: [],
});

const reconciliationDatabase = (businessReferences = 0) => {
  let exists = true;
  let retired = false;
  let images = 1;
  let inventory = 1;
  return {
    state: () => ({ exists, retired, images, inventory }),
    async $transaction(operation: (transaction: unknown) => Promise<unknown>) {
      return operation({
        category: {
          async upsert() {
            return { id: 'category' };
          },
        },
        inventoryMirror: {
          async findMany() {
            return [];
          },
          async createMany() {
            return { count: 0 };
          },
          async update() {
            return {};
          },
          async deleteMany() {
            inventory = 0;
            return { count: 1 };
          },
        },
        productImage: {
          async deleteMany() {
            images = 0;
            return { count: 1 };
          },
        },
        product: {
          async upsert() {
            return { id: 'product' };
          },
          async findUnique() {
            return exists
              ? {
                  id: 'local-101',
                  smaregiProductId: '101',
                  images: [
                    { imageUrl: 'https://media.example/uploads/101.png' },
                  ],
                  boxProductId: null,
                  boxedProduct: null,
                  _count: {
                    orderItems: businessReferences,
                    inventoryReservations: 0,
                    featuredCollectionProducts: 0,
                    editorialSections: 0,
                  },
                }
              : null;
          },
          async update() {
            retired = true;
            return {};
          },
          async delete() {
            exists = false;
            return {};
          },
        },
      });
    },
  };
};

test('report mode performs zero reconciliation mutations', async () => {
  const database = reconciliationDatabase();
  const result = await new SmaregiAtomicSyncRepository(
    database as never,
  ).applyValidatedPlan(emptySyncPlan, reconciliationPlan('report'));
  assert.deepEqual(database.state(), {
    exists: true,
    retired: false,
    images: 1,
    inventory: 1,
  });
  assert.equal(result.reconciliation.deletedProductCount, 0);
});

test('apply hard-deletes an unreferenced missing product and pure attachments', async () => {
  const database = reconciliationDatabase();
  const result = await new SmaregiAtomicSyncRepository(
    database as never,
  ).applyValidatedPlan(emptySyncPlan, reconciliationPlan('apply'));
  assert.deepEqual(database.state(), {
    exists: false,
    retired: false,
    images: 0,
    inventory: 0,
  });
  assert.equal(result.reconciliation.deletedProductCount, 1);
  assert.equal(result.reconciliation.deletedImages.length, 1);
});

test('a reference added before transaction recheck converts delete to RETIRE', async () => {
  const database = reconciliationDatabase(1);
  const result = await new SmaregiAtomicSyncRepository(
    database as never,
  ).applyValidatedPlan(emptySyncPlan, reconciliationPlan('apply'));
  assert.deepEqual(database.state(), {
    exists: true,
    retired: true,
    images: 1,
    inventory: 1,
  });
  assert.equal(result.reconciliation.retiredProductCount, 1);
});

test('repeated apply is idempotent after hard delete', async () => {
  const database = reconciliationDatabase();
  const repository = new SmaregiAtomicSyncRepository(database as never);
  await repository.applyValidatedPlan(
    emptySyncPlan,
    reconciliationPlan('apply'),
  );
  const second = await repository.applyValidatedPlan(
    emptySyncPlan,
    reconciliationPlan('apply'),
  );
  assert.equal(second.reconciliation.deletedProductCount, 0);
});

test('reappearing products restore active state but never auto-publish', () => {
  const update = mapSmaregiProductUpdate(sourceProduct, 'category', new Date());
  assert.equal(update.isActive, true);
  assert.equal('isEcAvailable' in update, false);
  const create = mapSmaregiProductCreate(
    sourceProduct,
    'category',
    '10.00',
    new Date(),
  );
  assert.equal(create.isEcAvailable, false);
});

test('S3 cleanup failure preserves committed DB result and returns retry-safe warning', async () => {
  process.env.AWS_CLOUDFRONT_DOMAIN = 'media.example';
  const cleanup = new SmaregiProductImageCleanupService(
    {
      async countImageUrlReferences() {
        return 0;
      },
    },
    async () => {
      throw new Error('secret provider detail');
    },
  );
  const result = await cleanup.cleanup({
    deletedProductCount: 1,
    retiredProductCount: 0,
    deletedImages: [
      {
        productId: 'local-101',
        smaregiProductId: '101',
        imageUrl: 'https://media.example/uploads/101.png',
      },
    ],
  });
  assert.equal(result.failureCount, 1);
  assert.equal(
    result.failures[0].message,
    'S3 object deletion failed and can be retried.',
  );
  assert.doesNotMatch(result.failures[0].message, /secret provider detail/);
});
