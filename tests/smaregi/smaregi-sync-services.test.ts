import assert from 'node:assert/strict';
import test from 'node:test';
import { SmaregiSyncRepository } from '@/repositories/smaregi-sync.repository';
import { SyncRepository } from '@/repositories/sync.repository';
import { MockSmaregiClient } from '@/services/smaregi/mock-smaregi-client';
import { SmaregiProductSyncService } from '@/services/smaregi/smaregi-product-sync.service';
import { SmaregiStoreService } from '@/services/smaregi/smaregi-store.service';

const client = new MockSmaregiClient({
  stores: [{ storeId: '1', storeName: 'Sandbox Store' }],
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
  products: [
    {
      productId: '100',
      categoryId: '10',
      productCode: 'S-100',
      productName: '同期商品',
      price: '2200',
      displayFlag: '1',
      salesDivision: '0',
      division: '0',
      taxDivision: '0',
      useCategoryReduceTax: '1',
      reduceTaxId: null,
    },
  ],
  consumptionTaxRates: [
    {
      applyStartDate: '2019-10-01',
      taxRate: '10.000',
      taxRounding: '1',
    },
  ],
});

test('records successful product synchronization', async () => {
  const events: string[] = [];
  const repository = {
    async upsertCategory() {
      return { id: 'local-category' };
    },
    async upsertProduct() {
      return { created: true };
    },
  };
  const logs = {
    async start() {
      events.push('start');
      return { id: 'log-1' };
    },
    async succeed() {
      events.push('success');
      return null;
    },
    async fail() {
      events.push('failure');
      return null;
    },
  };
  const stores = { async verifyConfiguredStore() {} };
  const service = new SmaregiProductSyncService(
    client,
    repository as unknown as SmaregiSyncRepository,
    logs as unknown as SyncRepository,
    stores as unknown as SmaregiStoreService,
  );

  const result = await service.fullSync();

  assert.deepEqual(result, {
    processed: 1,
    created: 1,
    updated: 0,
    skipped: 0,
  });
  assert.deepEqual(events, ['start', 'success']);
});

test('records a failed mapping without retrying it', async () => {
  const events: string[] = [];
  const invalidClient = new MockSmaregiClient({
    categories: [
      {
        categoryId: '11',
        categoryCode: 'CHILD',
        categoryName: '子部門',
        displaySequence: '1',
        displayFlag: '1',
        parentCategoryId: 'missing',
        taxDivision: '0',
        reduceTaxId: null,
      },
    ],
  });
  const repository = {
    async upsertCategory() {
      return { id: 'local-child' };
    },
    async upsertProduct() {
      return { created: false };
    },
  };
  const logs = {
    async start() {
      events.push('start');
      return { id: 'log-2' };
    },
    async succeed() {
      events.push('success');
      return null;
    },
    async fail() {
      events.push('failure');
      return null;
    },
  };
  const stores = { async verifyConfiguredStore() {} };
  const service = new SmaregiProductSyncService(
    invalidClient,
    repository as unknown as SmaregiSyncRepository,
    logs as unknown as SyncRepository,
    stores as unknown as SmaregiStoreService,
  );

  await assert.rejects(() => service.fullSync(), {
    code: 'SMAREGI_CATEGORY_MAPPING_FAILED',
  });
  assert.deepEqual(events, ['start', 'failure']);
  assert.equal(invalidClient.retryCount, 0);
});
