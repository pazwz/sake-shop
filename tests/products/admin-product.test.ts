import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAdminProductEditHref,
  sanitizeAdminProductsReturnTo,
} from '@/lib/admin-product-navigation';
import { Prisma } from '@prisma/client';
import { AdminProductService } from '@/services/admin-product.service';
import {
  adminProductQueryValidator,
  adminProductImageOrderValidator,
  adminProductUpdateValidator,
  productSlugValidator,
} from '@/validators/admin-product.validator';

const now = new Date('2026-09-01T00:00:00.000Z');
const fixture = (isEcAvailable = false) => ({
  id: 'product-1',
  smaregiProductId: '8000001',
  categoryId: 'category-1',
  productCode: 'TEST-SAKE-001',
  janCode: null,
  name: 'TEST 日本酒',
  slug: 'test-sake',
  price: new Prisma.Decimal('3000'),
  taxRate: new Prisma.Decimal('10'),
  producer: null,
  origin: null,
  volume: null,
  alcoholPercentage: null,
  description: null,
  tastingNotes: null,
  isActive: true,
  isEcAvailable,
  lastSyncedAt: now,
  createdAt: now,
  updatedAt: now,
  category: {
    id: 'category-1',
    smaregiCategoryId: '8000001',
    parentId: null,
    name: '日本酒',
    slug: 'sake',
    displayOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  images: [
    {
      id: 'image-1',
      productId: 'product-1',
      imageUrl: 'https://example.com/image.jpg',
      imageType: 'PRODUCT',
      displayOrder: 1,
      altText: null,
      createdAt: now,
      updatedAt: now,
    },
  ],
  inventoryMirrors: ['1', '2', '3', '6'].map((smaregiStoreId, index) => ({
    id: `inventory-${index}`,
    productId: 'product-1',
    smaregiStoreId,
    quantity: index === 0 ? 5 : 0,
    reservedQuantity: 0,
    availableQuantity: index === 0 ? 5 : 0,
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  })),
});

test('admin product edit link preserves the current list URL', () => {
  const returnTo =
    '/admin/products?q=moet&category=champagne&ecStatus=unpublished&source=smaregi&page=3';
  const href = createAdminProductEditHref('product-1', returnTo);
  const url = new URL(href, 'https://example.test');

  assert.equal(url.pathname, '/admin/products/product-1');
  assert.equal(url.searchParams.get('returnTo'), returnTo);
  assert.equal(sanitizeAdminProductsReturnTo(returnTo), returnTo);
});

test('admin product return URL rejects open redirects and unrelated paths', () => {
  for (const unsafe of [
    'https://evil.example.com/admin/products',
    '//evil.example.com/admin/products',
    '/admin/products/product-1',
    '/admin/products?next=https://evil.example.com',
    '/admin/products#unexpected',
  ]) {
    assert.equal(sanitizeAdminProductsReturnTo(unsafe), '/admin/products');
  }
});

test('strict update validation rejects Smaregi-owned fields', () => {
  for (const field of [
    'name',
    'price',
    'productCode',
    'categoryId',
    'isActive',
  ]) {
    assert.equal(
      adminProductUpdateValidator.safeParse({ [field]: 'forbidden' }).success,
      false,
    );
  }
});

test('update validation accepts only LINXAS-owned fields', () => {
  const result = adminProductUpdateValidator.parse({
    slug: 'LINXAS-SAKE',
    description: '説明',
    tastingNotes: '香り',
    isEcAvailable: true,
  });
  assert.equal(result.slug, 'linxas-sake');
});

test('admin list defaults to 25 rows and supports all filters', () => {
  const query = adminProductQueryValidator.parse({
    q: 'TEST',
    category: 'category-1',
    ecStatus: 'unpublished',
    source: 'smaregi',
    page: '2',
  });
  assert.equal(query.limit, 25);
  assert.equal(query.page, 2);
  assert.equal(query.ecStatus, 'unpublished');
  assert.equal(query.source, 'smaregi');
});

test('admin pagination calculates 18 pages for 441 products at 25 per page', async () => {
  const service = new AdminProductService(
    {
      findMany: async () => ({
        items: [],
        total: 441,
        categories: [],
      }),
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
  );
  const result = await service.getProducts(
    adminProductQueryValidator.parse({ page: 1 }),
  );
  assert.equal(result.pagination.limit, 25);
  assert.equal(result.pagination.totalPages, 18);
});

test('slug validator normalizes uppercase and rejects unsafe paths', () => {
  assert.equal(productSlugValidator.parse(' LINXAS-SAKE '), 'linxas-sake');
  assert.equal(productSlugValidator.safeParse('../sake').success, false);
});

test('false to true publication is blocked when validation fails', async () => {
  let updated = false;
  const repository = {
    findById: async () => fixture(false),
    update: async () => {
      updated = true;
      return fixture(true);
    },
  };
  const service = new AdminProductService(
    repository as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
    {
      validateProduct: async () => ({
        canPublish: false,
        errors: [{ code: 'IMAGE_REQUIRED', message: '画像が必要です。' }],
        warnings: [],
      }),
    } as never,
  );
  await assert.rejects(
    service.updateProduct('product-1', { isEcAvailable: true }),
    { code: 'PUBLICATION_VALIDATION_FAILED' },
  );
  assert.equal(updated, false);
});

test('true to false publication is allowed without publication validation', async () => {
  let validationCalls = 0;
  const service = new AdminProductService(
    {
      findById: async () => fixture(true),
      update: async () => fixture(false),
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
    {
      validateProduct: async () => {
        validationCalls += 1;
        return { canPublish: true, errors: [], warnings: [] };
      },
    } as never,
  );
  const result = await service.updateProduct('product-1', {
    isEcAvailable: false,
  });
  assert.equal(result.isEcAvailable, false);
  assert.equal(validationCalls, 1);
});

test('admin detail includes unpublished products and subtracts reservations', async () => {
  const service = new AdminProductService(
    { findById: async () => fixture(false) } as never,
    {
      getActiveReservedQuantities: async () => new Map([['product-1', 2]]),
    } as never,
    {
      validateProduct: async () => ({
        canPublish: true,
        errors: [],
        warnings: [],
      }),
    } as never,
  );
  const result = await service.getProduct('product-1');
  assert.equal(result.isEcAvailable, false);
  assert.equal(result.physicalTotalApproved, 5);
  assert.equal(result.availableQuantity, 3);
});

test('product image API service rejects URLs outside configured CloudFront uploads', async () => {
  const service = new AdminProductService({
    findById: async () => fixture(false),
    createImage: async () => {
      throw new Error('must not be called');
    },
  } as never);
  await assert.rejects(
    service.addImage('product-1', {
      imageUrl: 'https://example.com/image.jpg',
      altText: null,
    }),
    { code: 'VALIDATION_ERROR' },
  );
});

test('image order validation rejects duplicate image identifiers', () => {
  assert.equal(
    adminProductImageOrderValidator.safeParse({ imageIds: ['one', 'one'] })
      .success,
    false,
  );
});
