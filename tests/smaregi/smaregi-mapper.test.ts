import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateAvailableQuantity,
  mapSmaregiCategory,
  mapSmaregiProductCreate,
  mapSmaregiProductUpdate,
} from '@/services/smaregi/smaregi-mapper';
import type { SmaregiCategory, SmaregiProduct } from '@/types/smaregi';

const category: SmaregiCategory = {
  categoryId: '10',
  categoryCode: 'SAKE',
  categoryName: '日本酒',
  displaySequence: '2',
  displayFlag: '1',
  parentCategoryId: null,
};
const product: SmaregiProduct = {
  productId: '100',
  categoryId: '10',
  productCode: 'S-100',
  productName: '同期商品',
  price: '2200',
  displayFlag: '1',
  salesDivision: '0',
  division: '0',
};

test('maps category and product identities from Smaregi IDs', () => {
  assert.deepEqual(mapSmaregiCategory(category, null), {
    name: '日本酒',
    displayOrder: 2,
    isActive: true,
    parentId: null,
  });
  const created = mapSmaregiProductCreate(product, 'local-category');
  assert.equal(created.smaregiProductId, '100');
  assert.equal(created.categoryId, 'local-category');
  assert.equal(created.isEcAvailable, false);
});

test('product updates do not overwrite website-owned fields', () => {
  const update = mapSmaregiProductUpdate(product, 'local-category');
  for (const field of [
    'slug',
    'description',
    'tastingNotes',
    'isEcAvailable',
    'images',
  ]) {
    assert.equal(field in update, false, `${field} must remain website-owned`);
  }
});

test('inventory availability preserves website reservations', () => {
  assert.equal(calculateAvailableQuantity(12, 3), 9);
  assert.equal(calculateAvailableQuantity(2, 3), 0);
});
