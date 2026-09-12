import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPublicProductListHref,
  getPublicProductEffectivePage,
  getPublicProductPage,
  getPublicProductPageItems,
  getPublicProductPaginationState,
  getPublicProductPerPage,
  getPublicProductSort,
} from '@/config/public-product-pagination';
import { STANDALONE_EC_PRODUCT_WHERE } from '@/repositories/product.repository';
import { productQueryValidator } from '@/validators/product.validator';

test('public product pagination defaults to page 1 and 24 items', () => {
  assert.equal(getPublicProductPage(null), 1);
  assert.equal(getPublicProductPage('-1'), 1);
  assert.equal(getPublicProductPerPage(null), 24);
  assert.deepEqual(productQueryValidator.parse({}), {
    page: 1,
    limit: 24,
    sort: 'recommended',
  });
});

test('unsupported sorting falls back to recommended in the consumer URL', () => {
  assert.equal(getPublicProductSort('price_asc'), 'price_asc');
  assert.equal(getPublicProductSort('price-desc'), 'recommended');
});

test('public product pagination accepts only 24, 48, or 96 items', () => {
  assert.equal(getPublicProductPerPage('24'), 24);
  assert.equal(getPublicProductPerPage('48'), 48);
  assert.equal(getPublicProductPerPage('96'), 96);
  assert.equal(getPublicProductPerPage('9999'), 24);
  assert.equal(getPublicProductPerPage('20'), 24);
});

test('a page beyond the result range is clamped to the last page', () => {
  assert.equal(getPublicProductEffectivePage(99, 415, 24), 18);
  assert.equal(getPublicProductEffectivePage(3, 0, 24), 1);
});

test('search, sorting, and pagination coexist in the product URL', () => {
  assert.equal(
    buildPublicProductListHref(
      'q=山崎&group=whisky&sort=price_desc&perPage=48',
      { page: 3 },
    ),
    '/products?q=%E5%B1%B1%E5%B4%8E&group=whisky&sort=price_desc&perPage=48&page=3',
  );
});

test('search, sorting, and per-page changes reset to page 1', () => {
  assert.equal(
    buildPublicProductListHref(
      'q=山崎&group=whisky&sort=price_desc&page=10',
      { keyword: '白州' },
      { resetPage: true },
    ),
    '/products?q=%E7%99%BD%E5%B7%9E&group=whisky&sort=price_desc',
  );
  assert.equal(
    buildPublicProductListHref(
      'group=whisky&page=10',
      { perPage: 48 },
      { resetPage: true },
    ),
    '/products?group=whisky&perPage=48',
  );
});

test('long pagination ranges stay compact around the current page', () => {
  assert.deepEqual(getPublicProductPageItems(1, 18), [
    1,
    2,
    3,
    4,
    5,
    'ellipsis',
    18,
  ]);
  assert.deepEqual(getPublicProductPageItems(9, 18), [
    1,
    'ellipsis',
    7,
    8,
    9,
    10,
    11,
    'ellipsis',
    18,
  ]);
});

test('previous and next are disabled only at their valid boundaries', () => {
  assert.deepEqual(getPublicProductPaginationState(1, 18), {
    previousDisabled: true,
    nextDisabled: false,
  });
  assert.deepEqual(getPublicProductPaginationState(18, 18), {
    previousDisabled: false,
    nextDisabled: true,
  });
});

test('package-only and service-only products remain outside the total predicate', () => {
  const where = JSON.stringify(STANDALONE_EC_PRODUCT_WHERE);
  assert.match(where, /8000774/);
  assert.match(where, /8000511/);
  assert.match(where, /8000014/);
});
