import assert from 'node:assert/strict';
import test from 'node:test';
import { CollectionStatus, CollectionType } from '@prisma/client';
import { getCollectionProductCandidateWhere } from '@/repositories/product.repository';
import { FeaturedCollectionService } from '@/services/collection.service';

const existingCollection = {
  id: 'cmexisting0000000000000001',
  type: CollectionType.STORY,
  status: CollectionStatus.PUBLISHED,
  products: [{ productId: 'cminactive000000000000001' }],
};

test('collection candidates require public active standalone products without inventory filtering', () => {
  const where = JSON.stringify(getCollectionProductCandidateWhere());
  assert.match(where, /"isActive":true/);
  assert.match(where, /"isEcAvailable":true/);
  assert.match(where, /8000774/);
  assert.doesNotMatch(where, /inventoryMirrors/);
  assert.doesNotMatch(where, /availableQuantity/);
});

test('collection candidate search supports product, producer, code, and real category id', () => {
  const where = JSON.stringify(
    getCollectionProductCandidateWhere({
      q: '山崎',
      category: 'cmcategory000000000000001',
    }),
  );
  assert.match(where, /"name"/);
  assert.match(where, /"producer"/);
  assert.match(where, /"productCode"/);
  assert.match(where, /cmcategory000000000000001/);
});

test('existing unavailable collection products may remain while new products must be eligible', async () => {
  let replacedIds: string[] = [];
  const repository = {
    findAdminById: async () => existingCollection,
    update: async () => existingCollection,
    replaceProducts: async (_id: string, ids: string[]) => {
      replacedIds = ids;
      return existingCollection;
    },
  };
  const productRepository = {
    findEligibleCollectionProductIds: async (ids: string[]) =>
      ids.map((id) => ({ id })),
  };
  const service = new FeaturedCollectionService(
    repository as never,
    productRepository as never,
  );

  await service.updateCollection(existingCollection.id, {
    productIds: ['cminactive000000000000001', 'cmeligible000000000000001'],
  });
  assert.deepEqual(replacedIds, [
    'cminactive000000000000001',
    'cmeligible000000000000001',
  ]);
});

test('new unavailable products are rejected by the service even if the UI is bypassed', async () => {
  const service = new FeaturedCollectionService(
    {
      findAdminById: async () => existingCollection,
    } as never,
    {
      findEligibleCollectionProductIds: async () => [],
    } as never,
  );

  await assert.rejects(
    service.updateCollection(existingCollection.id, {
      productIds: ['cminactive000000000000001', 'cmineligible00000000000001'],
    }),
    /非公開または販売終了/,
  );
});

test('admin content management delegates to the complete editorial and story projection', async () => {
  const expected = [
    { id: 'editorial-1', type: CollectionType.EDITORIAL },
    { id: 'story-3', type: CollectionType.STORY },
  ];
  const service = new FeaturedCollectionService({
    findAdminContentCollections: async () => expected,
  } as never);
  assert.deepEqual(await service.getAdminContentCollections(), expected);
});

test('homepage admin management returns all published stories without a slot limit', async () => {
  const stories = ['story-1', 'story-2', 'story-3'].map((id) => ({
    id,
    type: CollectionType.STORY,
    status: CollectionStatus.PUBLISHED,
    season: null,
    products: [],
  }));
  const service = new FeaturedCollectionService({
    findAdminCollections: async () => stories,
  } as never);

  const result = await service.getAdminHomeManagement();
  assert.deepEqual(
    result.story.map(({ id }) => id),
    ['story-1', 'story-2', 'story-3'],
  );
});
