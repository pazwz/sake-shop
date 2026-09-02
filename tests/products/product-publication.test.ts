import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { ProductPublicationService } from '@/services/product-publication.service';

const product = (overrides: Record<string, unknown> = {}) => ({
  id: 'product-1',
  smaregiProductId: '8000001',
  price: new Prisma.Decimal('3000'),
  slug: 'test-sake',
  isActive: true,
  lastSyncedAt: new Date('2026-09-01T00:00:00.000Z'),
  description: '商品説明',
  images: [{ id: 'image-1' }],
  inventoryMirrors: [
    { smaregiStoreId: '1', quantity: 0 },
    { smaregiStoreId: '2', quantity: 0 },
    { smaregiStoreId: '3', quantity: 0 },
    { smaregiStoreId: '6', quantity: 0 },
  ],
  ...overrides,
});

const validate = async (
  overrides: Record<string, unknown> = {},
  slugOwner: { id: string } | null = null,
) =>
  new ProductPublicationService({
    findSlugOwner: async () => slugOwner,
  } as never).validateProduct(product(overrides) as never, 0);

test('allows a valid synchronized product to publish', async () => {
  const result = await validate();
  assert.equal(result.canPublish, true);
  assert.deepEqual(result.errors, []);
});

test('blocks inactive and zero-price products', async () => {
  const result = await validate({
    isActive: false,
    price: new Prisma.Decimal(0),
  });
  assert.deepEqual(
    result.errors.map(({ code }) => code),
    ['PRODUCT_INACTIVE', 'PRICE_INVALID'],
  );
});

test('blocks missing, invalid, and duplicate slugs', async () => {
  assert.equal((await validate({ slug: '' })).errors[0]?.code, 'SLUG_MISSING');
  assert.equal(
    (await validate({ slug: 'Invalid Slug' })).errors[0]?.code,
    'SLUG_INVALID',
  );
  assert.equal(
    (await validate({}, { id: 'another-product' })).errors[0]?.code,
    'SLUG_DUPLICATE',
  );
});

test('blocks products without an image or valid Smaregi sync source', async () => {
  const result = await validate({
    images: [],
    smaregiProductId: '',
    lastSyncedAt: null,
  });
  assert.deepEqual(
    result.errors.map(({ code }) => code),
    ['IMAGE_REQUIRED', 'SYNC_SOURCE_INVALID'],
  );
});

test('allows zero stock with an explicit warning', async () => {
  const result = await validate();
  assert.equal(result.canPublish, true);
  assert.equal(
    result.warnings.some(({ code }) => code === 'OUT_OF_STOCK'),
    true,
  );
});

test('warns but does not block when description is missing', async () => {
  const result = await validate({ description: null });
  assert.equal(result.canPublish, true);
  assert.equal(
    result.warnings.some(({ code }) => code === 'DESCRIPTION_RECOMMENDED'),
    true,
  );
});
