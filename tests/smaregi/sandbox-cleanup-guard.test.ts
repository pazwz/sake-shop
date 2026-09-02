import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type SandboxCleanupCandidate,
  validateSandboxCleanupCandidate,
} from '@/services/smaregi/sandbox-cleanup-guard';

const exactCandidate = (): SandboxCleanupCandidate => {
  const categoryId = 'test-category';
  const products = [
    ['8000001', 'TEST-SAKE-001', 'TEST 日本酒', 'sake', 5],
    ['8000002', 'TEST-WHISKY-001', 'TEST ウイスキー', 'whisky', 2],
    ['8000003', 'TEST-WINE-001', 'TEST ワイン', 'wine', 0],
  ].map(([smaregiProductId, productCode, name, slugPart, quantity], index) => ({
    product: {
      id: `product-${index}`,
      smaregiProductId: String(smaregiProductId),
      categoryId,
      productCode: String(productCode),
      name: String(name),
      slug: `smaregi-product-test-${slugPart}-001`,
      isEcAvailable: false,
    },
    inventory: {
      productId: `product-${index}`,
      smaregiStoreId: '1',
      quantity: Number(quantity),
      reservedQuantity: 0,
      availableQuantity: Number(quantity),
    },
  }));
  return {
    category: {
      id: categoryId,
      smaregiCategoryId: '8000001',
      name: 'EST EC連携',
      slug: 'smaregi-category-test-ec',
      productCount: 3,
    },
    products: products.map((item) => item.product),
    inventory: products.map((item) => item.inventory),
    dependencyCount: 0,
  };
};

test('accepts only the exact sandbox TEST candidate', () => {
  assert.deepEqual(validateSandboxCleanupCandidate(exactCandidate()), {
    categoryId: 'test-category',
    productIds: ['product-0', 'product-1', 'product-2'],
  });
});

test('aborts cleanup when any guard differs', () => {
  const cases = [
    () => {
      const value = exactCandidate();
      value.category!.name = 'jpウイスキー';
      return value;
    },
    () => {
      const value = exactCandidate();
      value.products[0].productCode = '4901777188914';
      return value;
    },
    () => {
      const value = exactCandidate();
      value.inventory[0].quantity = 40;
      return value;
    },
    () => {
      const value = exactCandidate();
      value.dependencyCount = 1;
      return value;
    },
  ];
  for (const createCandidate of cases)
    assert.throws(() => validateSandboxCleanupCandidate(createCandidate()));
});
