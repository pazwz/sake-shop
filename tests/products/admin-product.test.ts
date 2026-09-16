import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAdminProductEditHref,
  sanitizeAdminProductsReturnTo,
} from '@/lib/admin-product-navigation';
import { Prisma } from '@prisma/client';
import { buildAdminProductWhere } from '@/repositories/admin-product.repository';
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
  isManuallyHidden: false,
  lastSyncedAt: now,
  createdAt: now,
  updatedAt: now,
  boxProductId: null,
  boxProduct: null,
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

const fixtureWithIdentity = (
  smaregiProductId: string,
  name: string,
  productCode = `CODE-${smaregiProductId}`,
) => ({
  ...fixture(false),
  smaregiProductId,
  productCode,
  name,
});

const domPerignonBoxCandidate = () => ({
  id: 'dom-perignon-box',
  smaregiProductId: '8000774',
  productCode: '49001777016496',
  name: 'ドンペリニヨン箱',
  price: new Prisma.Decimal('2200'),
  taxRate: new Prisma.Decimal('10'),
  isActive: true,
  lastSyncedAt: now,
  category: fixture(false).category,
  inventoryMirrors: fixture(false).inventoryMirrors,
});

const publication = {
  validateProduct: async () => ({
    canPublish: true,
    errors: [],
    warnings: [],
  }),
};

const reservations = {
  getActiveReservedQuantities: async () => new Map<string, number>(),
};

test('admin product edit link preserves the current list URL', () => {
  const returnTo =
    '/admin/products?q=moet&category=champagne&ecStatus=preparing&source=smaregi&imageStatus=without&metadataStatus=core_incomplete&missingField=alcoholPercentage&page=3';
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
    '/admin/products?imageStatus=unexpected',
    '/admin/products?metadataStatus=unexpected',
    '/admin/products?missingField=unexpected',
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

test('update validation accepts one nullable linked box product', () => {
  assert.deepEqual(
    adminProductUpdateValidator.parse({
      boxProductId: 'cm12345678901234567890123',
    }),
    { boxProductId: 'cm12345678901234567890123' },
  );
  assert.deepEqual(adminProductUpdateValidator.parse({ boxProductId: null }), {
    boxProductId: null,
  });
});

test('admin list defaults to 25 rows and supports all filters', () => {
  const query = adminProductQueryValidator.parse({
    q: 'TEST',
    category: 'category-1',
    ecStatus: 'preparing',
    source: 'smaregi',
    imageStatus: 'without',
    metadataStatus: 'core_incomplete',
    missingField: 'alcoholPercentage',
    page: '2',
  });
  assert.equal(query.limit, 25);
  assert.equal(query.page, 2);
  assert.equal(query.ecStatus, 'preparing');
  assert.equal(query.source, 'smaregi');
  assert.equal(query.imageStatus, 'without');
  assert.equal(query.metadataStatus, 'core_incomplete');
  assert.equal(query.missingField, 'alcoholPercentage');
});

test('admin image status filters are translated to server-side relation filters', () => {
  const withImages = buildAdminProductWhere(
    adminProductQueryValidator.parse({ imageStatus: 'with' }),
  );
  const withoutImages = buildAdminProductWhere(
    adminProductQueryValidator.parse({ q: '山崎', imageStatus: 'without' }),
  );

  assert.match(JSON.stringify(withImages), /"images":\{"some":\{\}\}/);
  assert.match(JSON.stringify(withoutImages), /"images":\{"none":\{\}\}/);
  assert.match(JSON.stringify(withoutImages), /"OR"/);
});

test('admin metadata filters are translated to published database predicates', () => {
  const missingAbv = buildAdminProductWhere(
    adminProductQueryValidator.parse({
      missingField: 'alcoholPercentage',
    }),
    ['excluded-product'],
  );
  const coreIncomplete = buildAdminProductWhere(
    adminProductQueryValidator.parse({
      metadataStatus: 'core_incomplete',
    }),
    ['excluded-product'],
  );
  const complete = buildAdminProductWhere(
    adminProductQueryValidator.parse({ metadataStatus: 'complete' }),
    ['excluded-product'],
  );

  assert.match(JSON.stringify(missingAbv), /"alcoholPercentage":null/);
  assert.match(JSON.stringify(missingAbv), /"isEcAvailable":true/);
  assert.match(JSON.stringify(missingAbv), /"isManuallyHidden":false/);
  assert.match(JSON.stringify(coreIncomplete), /"images":\{"none":\{\}\}/);
  assert.match(JSON.stringify(complete), /"images":\{"some":\{\}\}/);
  assert.match(JSON.stringify(complete), /"tastingNotes"/);
});

test('a non-published EC status cannot enter the published metadata workflow', () => {
  const where = buildAdminProductWhere(
    adminProductQueryValidator.parse({
      ecStatus: 'preparing',
      missingField: 'alcoholPercentage',
    }),
  );
  const serialized = JSON.stringify(where);
  assert.match(serialized, /"isEcAvailable":false/);
  assert.match(serialized, /"isEcAvailable":true/);
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

test('manual hiding is recorded separately from publication readiness', async () => {
  let updateData: Record<string, unknown> | null = null;
  const service = new AdminProductService(
    {
      findById: async () => fixture(true),
      update: async (_id: string, data: Record<string, unknown>) => {
        updateData = data;
        return { ...fixture(true), isManuallyHidden: true };
      },
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
    publication as never,
  );

  const result = await service.updateProduct('product-1', {
    ecVisibility: 'hidden',
  });
  assert.equal(
    (updateData as Record<string, unknown> | null)?.isManuallyHidden,
    true,
  );
  assert.equal(result.ecStatus, 'HIDDEN');
});

test('admin detail includes unpublished products and subtracts reservations', async () => {
  const service = new AdminProductService(
    {
      findById: async () => fixture(false),
      findBoxCandidates: async () => [],
    } as never,
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

test('YUZA cannot see the Dom Perignon package candidate', async () => {
  const service = new AdminProductService(
    {
      findById: async () => fixtureWithIdentity('8000900', 'YUZA'),
      findBoxCandidates: async (compatibleIds: readonly string[]) => {
        assert.deepEqual(compatibleIds, []);
        return [domPerignonBoxCandidate()];
      },
    } as never,
    reservations as never,
    publication as never,
  );

  const result = await service.getProduct('product-1');
  assert.deepEqual(result.boxCandidates, []);
  assert.equal(result.expectedBox, null);
});

test('Yamazaki 12 cannot see the Dom Perignon package candidate', async () => {
  const service = new AdminProductService(
    {
      findById: async () => fixtureWithIdentity('8000001', '山崎12年'),
      findBoxCandidates: async (compatibleIds: readonly string[]) => {
        assert.deepEqual(compatibleIds, ['8000570']);
        return [domPerignonBoxCandidate()];
      },
    } as never,
    reservations as never,
    publication as never,
  );

  const result = await service.getProduct('product-1');
  assert.deepEqual(result.boxCandidates, []);
});

test('a product without an explicit compatibility mapping has zero candidates', async () => {
  const service = new AdminProductService(
    {
      findById: async () => fixtureWithIdentity('8000999', '而今'),
      findBoxCandidates: async () => [],
    } as never,
    reservations as never,
    publication as never,
  );

  const result = await service.getProduct('product-1');
  assert.equal(result.boxCandidates.length, 0);
});

test('deferred Yamazaki 12 exposes only its tax-setting wait state', async () => {
  const service = new AdminProductService(
    {
      findById: async () => fixtureWithIdentity('8000001', '山崎12年'),
      findBoxCandidates: async () => [],
    } as never,
    reservations as never,
    publication as never,
  );

  const result = await service.getProduct('product-1');
  assert.deepEqual(result.expectedBox, {
    smaregiProductId: '8000570',
    name: '山崎12年 箱代金',
    reason: 'CATEGORY_TAX_DIVISION_MISSING',
  });
  assert.deepEqual(result.boxCandidates, []);
});

test('only the standard Dom Perignon product can see package 8000774', async () => {
  const box = domPerignonBoxCandidate();
  const service = new AdminProductService(
    {
      findById: async () =>
        fixtureWithIdentity('8000052', 'ドンペリニヨン', '3185370735695'),
      findBoxCandidates: async (compatibleIds: readonly string[]) => {
        assert.deepEqual(compatibleIds, ['8000774']);
        return [box];
      },
    } as never,
    reservations as never,
    publication as never,
  );

  const result = await service.getProduct('product-1');
  assert.deepEqual(
    result.boxCandidates.map(({ smaregiProductId }) => smaregiProductId),
    ['8000774'],
  );
});

test('a normal product cannot bind an incompatible package candidate', async () => {
  let updated = false;
  const service = new AdminProductService(
    {
      findById: async () => fixtureWithIdentity('8000900', 'YUZA'),
      findBoxCandidates: async () => [domPerignonBoxCandidate()],
      update: async () => {
        updated = true;
        return fixture(false);
      },
    } as never,
    reservations as never,
    publication as never,
  );

  await assert.rejects(
    service.updateProduct('product-1', {
      boxProductId: 'dom-perignon-box',
    }),
    { code: 'VALIDATION_ERROR' },
  );
  assert.equal(updated, false);
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
