import assert from 'node:assert/strict';
import test from 'node:test';
import { CategoryService } from '@/services/category.service';

test('header navigation groups only categories that actually exist', async () => {
  const service = new CategoryService({
    findPublicProductCategories: async () => [
      {
        id: 'japanese-whisky',
        name: 'ジャパニーズウイスキー',
        slug: 'japanese-whisky',
        displayOrder: 1,
      },
      {
        id: 'champagne',
        name: 'シャンパン',
        slug: 'champagne',
        displayOrder: 2,
      },
    ],
  } as never);
  const groups = await service.getHeaderNavigation();
  assert.deepEqual(
    groups.find(({ id }) => id === 'whisky')?.links.map(({ label }) => label),
    ['ジャパニーズウイスキー'],
  );
  assert.deepEqual(
    groups
      .find(({ id }) => id === 'wine-champagne')
      ?.links.map(({ label }) => label),
    ['シャンパン'],
  );
  assert.deepEqual(groups.find(({ id }) => id === 'sake')?.links, []);
});
