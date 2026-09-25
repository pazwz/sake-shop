import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildPublicProductGroupHref,
  getPublicProductGroupSelectValue,
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

test('consumer product group selector uses the shared public navigation', () => {
  assert.deepEqual(
    PUBLIC_PRODUCT_NAVIGATION.map(({ id, label }) => ({ id, label })),
    [
      { id: 'sake', label: '日本酒' },
      { id: 'whisky', label: 'ウイスキー' },
      { id: 'wine-champagne', label: 'ワイン・シャンパン' },
      { id: 'shochu', label: '焼酎' },
      { id: 'brandy-spirits', label: 'ブランデー・スピリッツ' },
    ],
  );
  const labels: readonly string[] = PUBLIC_PRODUCT_NAVIGATION.map(
    ({ label }) => label,
  );
  assert.equal(labels.includes('箱'), false);
  assert.equal(labels.includes('リキュール'), false);
});

test('product group select value is derived from the URL group', () => {
  assert.equal(getPublicProductGroupSelectValue(null), '');
  assert.equal(getPublicProductGroupSelectValue('whisky'), 'whisky');
  assert.equal(getPublicProductGroupSelectValue('sake'), 'sake');
  assert.equal(getPublicProductGroupSelectValue('unknown'), '');
});

test('changing the public group updates the URL and removes raw categories', () => {
  assert.equal(
    buildPublicProductGroupHref(
      'category=box&sort=price_asc&page=8&perPage=48',
      'whisky',
    ),
    '/products?sort=price_asc&perPage=48&group=whisky',
  );
  assert.equal(buildPublicProductGroupHref('group=whisky', ''), '/products');
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

test('authenticated header uses an accessible SVG bell rather than a unicode diamond', async () => {
  const header = await readFile(`${process.cwd()}/components/header.tsx`, 'utf8');
  assert.match(header, /function BellIcon/);
  assert.match(header, /aria-label="お知らせ"/);
  assert.match(header, /<BellIcon className="h-4 w-4" \/>/);
  assert.doesNotMatch(header, /♢/);
});
