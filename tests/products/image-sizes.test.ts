import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProductCard } from '@/components/product-card';

const product = {
  id: 'image-layout-test',
  slug: 'image-layout-test',
  name: 'Test product',
  category: 'Test category',
  producer: null,
  price: 1000,
  image: '/test.png',
};

test('list card advertises two-column mobile and four-column desktop image slots', () => {
  const html = renderToStaticMarkup(createElement(ProductCard, { product }));
  assert.match(html, /sizes="[^\"]*50vw - 32px/);
  assert.match(html, /sizes="[^\"]*25vw - 54px/);
  assert.match(html, /sizes="[^\"]*308px/);
});
