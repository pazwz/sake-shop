import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { PUBLIC_PRODUCT_VISIBILITY } from '@/repositories/product.repository';
import { sanitizePublicCollections } from '@/services/collection.service';
import { ProductService } from '@/services/product.service';
import {
  isPackageOnlyProduct,
  isStandaloneEcProduct,
} from '@/services/product-visibility.service';
import { productQueryValidator } from '@/validators/product.validator';

test('public list and search predicates require active and EC-published products', () => {
  assert.equal(PUBLIC_PRODUCT_VISIBILITY.isActive, true);
  assert.equal(PUBLIC_PRODUCT_VISIBILITY.isEcAvailable, true);
  assert.equal(PUBLIC_PRODUCT_VISIBILITY.isManuallyHidden, false);
});

test('package-only products are excluded by Smaregi identity and box category', () => {
  assert.equal(
    isPackageOnlyProduct({
      smaregiProductId: '8000570',
      category: { smaregiCategoryId: '8000001' },
    }),
    true,
  );
  assert.equal(
    isStandaloneEcProduct({
      smaregiProductId: 'another-product',
      category: { smaregiCategoryId: '8000014' },
    }),
    false,
  );
});

test('an alcohol product whose name includes box wording is not misclassified', () => {
  assert.equal(
    isStandaloneEcProduct({
      smaregiProductId: '8000999',
      category: { smaregiCategoryId: '8000001' },
    }),
    true,
  );
});

test('explicit service-only products are not standalone EC products', () => {
  assert.equal(
    isStandaloneEcProduct({
      smaregiProductId: '8000511',
      category: { smaregiCategoryId: '8000001' },
    }),
    false,
  );
});

test('direct product detail rejects an unpublished product', async () => {
  const product = {
    id: 'product-1',
    isActive: true,
    isEcAvailable: false,
  };
  const service = new ProductService(
    {
      findById: async () => product,
      findBySlug: async () => null,
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
  );
  await assert.rejects(service.getProduct('product-1'), {
    name: 'NotFoundError',
  });
});

const productFixture = (overrides: Record<string, unknown> = {}) => ({
  id: 'product-1',
  slug: 'published-product',
  name: 'Published Product',
  productCode: 'PUBLIC-001',
  producer: null,
  origin: null,
  category: {
    id: 'category-1',
    smaregiCategoryId: '8000001',
    name: 'Whisky',
    slug: 'whisky',
    parent: null,
  },
  price: 5000,
  taxRate: 10,
  volume: null,
  alcoholPercentage: null,
  description: null,
  tastingNotes: null,
  images: [],
  inventoryMirrors: [],
  boxProduct: null,
  boxProductId: null,
  isActive: true,
  isEcAvailable: true,
  isManuallyHidden: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

test('published and active product detail resolves by slug', async () => {
  const product = productFixture();
  const service = new ProductService(
    {
      findBySlug: async () => product,
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
  );

  const result = await service.getProductBySlug('published-product');
  assert.equal(result.slug, 'published-product');
  assert.equal(result.isEcAvailable, true);
});

test('product detail rejects an unpublished product by slug', async () => {
  const service = new ProductService(
    {
      findBySlug: async () => productFixture({ isEcAvailable: false }),
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
  );

  await assert.rejects(service.getProductBySlug('unpublished-product'), {
    name: 'NotFoundError',
  });
});

test('product detail rejects an inactive product by slug', async () => {
  const service = new ProductService(
    {
      findBySlug: async () => productFixture({ isActive: false }),
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
  );

  await assert.rejects(service.getProductBySlug('inactive-product'), {
    name: 'NotFoundError',
  });
});

test('product detail rejects a manually hidden product by slug', async () => {
  const service = new ProductService(
    {
      findBySlug: async () => productFixture({ isManuallyHidden: true }),
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
  );

  await assert.rejects(service.getProductBySlug('hidden-product'), {
    name: 'NotFoundError',
  });
});

test('product detail rejects a package-only product even if flags are public', async () => {
  const service = new ProductService(
    {
      findBySlug: async () =>
        productFixture({
          smaregiProductId: '8000570',
          category: {
            id: 'box-category',
            name: '箱',
            slug: 'box',
            smaregiCategoryId: '8000014',
            parent: null,
          },
        }),
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
  );
  await assert.rejects(service.getProductBySlug('box-product'), {
    name: 'NotFoundError',
  });
});

test('linked box with zero stock is present but unavailable for selection', async () => {
  const boxProduct = {
    id: 'box-product',
    smaregiProductId: '8000570',
    productCode: 'BOX-001',
    name: '純正箱',
    price: new Prisma.Decimal(500),
    taxRate: new Prisma.Decimal(10),
    isActive: true,
    category: { smaregiCategoryId: '8000014' },
    inventoryMirrors: [],
  };
  const service = new ProductService(
    {
      findBySlug: async () => productFixture({ boxProduct }),
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
  );
  const result = await service.getProductBySlug('published-product');
  assert.equal(result.boxOption?.availableQuantity, 0);
  assert.equal(result.boxOption?.isAvailable, false);
});

test('product detail rejects a missing slug', async () => {
  const service = new ProductService(
    {
      findBySlug: async () => null,
    } as never,
    { getActiveReservedQuantities: async () => new Map() } as never,
  );

  await assert.rejects(service.getProductBySlug('missing-product'), {
    name: 'NotFoundError',
  });
});

test('home and collection sanitization removes unpublished and inactive products', () => {
  const identity = {
    smaregiProductId: '8000001',
    category: { smaregiCategoryId: '8000001' },
  };
  const visible = {
    id: 'visible',
    isActive: true,
    isEcAvailable: true,
    ...identity,
  };
  const unpublished = {
    id: 'unpublished',
    isActive: true,
    isEcAvailable: false,
    ...identity,
  };
  const inactive = {
    id: 'inactive',
    isActive: false,
    isEcAvailable: true,
    ...identity,
  };
  const [collection] = sanitizePublicCollections([
    {
      id: 'collection-1',
      products: [visible, unpublished, inactive].map((product) => ({
        product,
      })),
      editorialSections: [
        { id: 'section-1', product: visible },
        { id: 'section-2', product: unpublished },
      ],
    },
  ]);
  assert.deepEqual(
    collection.products.map(({ product }) => product.id),
    ['visible'],
  );
  assert.equal(collection.editorialSections[0].product?.id, 'visible');
  assert.equal(collection.editorialSections[1].product, null);
});

test('home and collection sanitization removes package-only products', () => {
  const bottle = {
    id: 'bottle',
    isActive: true,
    isEcAvailable: true,
    smaregiProductId: '8000001',
    category: { smaregiCategoryId: '8000001' },
  };
  const box = {
    id: 'box',
    isActive: true,
    isEcAvailable: true,
    smaregiProductId: '8000570',
    category: { smaregiCategoryId: '8000014' },
  };
  const [collection] = sanitizePublicCollections([
    {
      products: [{ product: bottle }, { product: box }],
      editorialSections: [{ product: box }],
    },
  ]);
  assert.deepEqual(
    collection.products.map(({ product }) => product.id),
    ['bottle'],
  );
  assert.equal(collection.editorialSections[0].product, null);
});

test('public query validator preserves category, group, search, and season filters', () => {
  const query = productQueryValidator.parse({
    category: 'whisky',
    group: 'wine-champagne',
    keyword: '山崎',
    season: 'autumn',
  });
  assert.equal(query.category, 'whisky');
  assert.equal(query.group, 'wine-champagne');
  assert.equal(query.keyword, '山崎');
  assert.equal(query.season, 'autumn');
});
