import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('shared ProductCard constrains image and text to the same card width', async () => {
  const source = await readFile('components/product-card.tsx', 'utf8');
  assert.match(
    source,
    /product-card group flex w-full min-w-0 max-w-full flex-col/,
  );
  assert.match(source, /product-card-image[^\n]+w-full[^\n]+max-w-full/);
  assert.match(
    source,
    /product-card-info w-full min-w-0 max-w-full \[overflow-wrap:anywhere\]/,
  );
});

test('shared ProductCard keeps long metadata and names wrappable', async () => {
  const source = await readFile('components/product-card.tsx', 'utf8');
  assert.doesNotMatch(source, /whitespace-nowrap/);
  assert.match(source, /product-card-meta[^\n]+max-w-full/);
  assert.match(source, /product-card-title[^\n]+max-w-full/);
  assert.match(source, /product-card-price[^\n]+max-w-full/);
});
