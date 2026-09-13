import assert from 'node:assert/strict';
import test from 'node:test';
import { CollectionStatus, CollectionType } from '@prisma/client';
import {
  getPublicCollectionPath,
  isPublicCollectionAt,
} from '@/config/collections';
import { FeaturedCollectionService } from '@/services/collection.service';

const now = new Date('2026-09-12T12:00:00.000Z');

const navigationCollection = (overrides: Record<string, unknown> = {}) => ({
  id: 'story-1',
  type: CollectionType.STORY,
  title: '季節を味わう',
  season: null,
  status: CollectionStatus.PUBLISHED,
  publishStartAt: null,
  publishEndAt: null,
  ...overrides,
});

const detailedCollection = (id: string) => ({
  ...navigationCollection({ id, title: id }),
  products: [],
  editorialSections: [],
});

test('missing collections do not generate public navigation entries', async () => {
  const service = new FeaturedCollectionService({
    findNavigationCollections: async () => [],
  } as never);
  assert.deepEqual(await service.getHeaderNavigation(), []);
});

test('unpublished and out-of-window collections do not generate entries', async () => {
  const service = new FeaturedCollectionService({
    findNavigationCollections: async () => [
      navigationCollection({ status: CollectionStatus.DRAFT }),
      navigationCollection({
        id: 'future-story',
        publishStartAt: new Date('2100-01-01T00:00:00.000Z'),
      }),
    ],
  } as never);
  assert.deepEqual(await service.getHeaderNavigation(), []);
});

test('a current published collection generates its real public URL', async () => {
  const collection = navigationCollection();
  assert.equal(isPublicCollectionAt(collection, now), true);
  assert.equal(
    getPublicCollectionPath(collection),
    '/collections/story-story-1',
  );

  const service = new FeaturedCollectionService({
    findNavigationCollections: async () => [collection],
  } as never);
  assert.deepEqual(await service.getHeaderNavigation(), [
    { label: '季節を味わう', href: '/collections/story-story-1' },
  ]);
});

test('story detail resolution is not limited by the homepage story count', async () => {
  const collections = [
    detailedCollection('story-1'),
    detailedCollection('story-2'),
    detailedCollection('story-3'),
  ];
  const service = new FeaturedCollectionService({
    findPublished: async () => collections,
  } as never);

  const result = await service.getPublicCollectionDetail('story-story-3');
  assert.equal(result?.id, 'story-3');
});

test('homepage returns every published story in repository display order', async () => {
  const collections = [
    detailedCollection('story-1'),
    detailedCollection('story-2'),
    detailedCollection('story-3'),
    detailedCollection('story-4'),
  ];
  const service = new FeaturedCollectionService({
    findPublished: async () => collections,
  } as never);

  const result = await service.getHome();
  assert.deepEqual(
    result.story.map(({ id }) => id),
    ['story-1', 'story-2', 'story-3', 'story-4'],
  );
});

test('homepage story count follows current published data and excludes archived stories', async () => {
  const service = new FeaturedCollectionService({
    findPublished: async () =>
      [
        detailedCollection('story-1'),
        detailedCollection('story-2'),
        detailedCollection('story-archived'),
      ].map((collection) =>
        collection.id === 'story-archived'
          ? { ...collection, status: CollectionStatus.ARCHIVED }
          : collection,
      ),
  } as never);

  const result = await service.getHome();
  assert.deepEqual(
    result.story.map(({ id }) => id),
    ['story-1', 'story-2'],
  );
});
