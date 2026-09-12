import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PUBLIC_EXPLORE_NAVIGATION,
  PUBLIC_PRODUCT_NAVIGATION,
} from '@/config/public-navigation';
import { CategoryService } from '@/services/category.service';

test('header and homepage share the same public product navigation', () => {
  assert.deepEqual(
    PUBLIC_EXPLORE_NAVIGATION.map(({ label, href }) => ({ label, href })),
    [
      { label: '日本酒', href: '/products?group=sake' },
      { label: 'ウイスキー', href: '/products?group=whisky' },
      {
        label: 'ワイン・シャンパン',
        href: '/products?group=wine-champagne',
      },
      { label: '焼酎', href: '/products?group=shochu' },
      {
        label: 'ブランデー・スピリッツ',
        href: '/products?group=brandy-spirits',
      },
      { label: '特集', href: '/collections/seasonal' },
    ],
  );
  const labels: readonly string[] = PUBLIC_EXPLORE_NAVIGATION.map(
    ({ label }) => label,
  );
  assert.equal(labels.includes('リキュール'), false);
});

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
    groups.map(({ id, label, href }) => ({ id, label, href })),
    PUBLIC_PRODUCT_NAVIGATION.map(({ id, label, href }) => ({
      id,
      label,
      href,
    })),
  );
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
