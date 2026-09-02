import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLIC_PRODUCT_VISIBILITY } from '@/repositories/product.repository';
import { sanitizePublicCollections } from '@/services/collection.service';
import { ProductService } from '@/services/product.service';
import { productQueryValidator } from '@/validators/product.validator';

test('public list and search predicates require active and EC-published products', () => {
  assert.equal(PUBLIC_PRODUCT_VISIBILITY.isActive, true);
  assert.equal(PUBLIC_PRODUCT_VISIBILITY.isEcAvailable, true);
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
  isActive: true,
  isEcAvailable: true,
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
  const visible = { id: 'visible', isActive: true, isEcAvailable: true };
  const unpublished = {
    id: 'unpublished',
    isActive: true,
    isEcAvailable: false,
  };
  const inactive = { id: 'inactive', isActive: false, isEcAvailable: true };
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

test('public query validator preserves category, search, and season filters', () => {
  const query = productQueryValidator.parse({
    category: 'whisky',
    keyword: '山崎',
    season: 'autumn',
  });
  assert.equal(query.category, 'whisky');
  assert.equal(query.keyword, '山崎');
  assert.equal(query.season, 'autumn');
});
