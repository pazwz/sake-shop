import assert from 'node:assert/strict';
import test from 'node:test';
import { getProducts } from '@/lib/product-api';

test('a cancelled Product read does not complete an obsolete request', async (context) => {
  const controller = new AbortController();
  controller.abort();
  context.mock.method(
    globalThis,
    'fetch',
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw init.signal.reason;
      return Response.json({
        success: true,
        data: {
          items: [],
          pagination: { page: 1, limit: 24, total: 0, totalPages: 0 },
        },
      });
    },
  );
  await assert.rejects(
    getProducts(new URLSearchParams('page=1&limit=24'), controller.signal),
    { name: 'AbortError' },
  );
});

test('Product read errors stay visible and are not retried', async (context) => {
  let requests = 0;
  context.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return Response.json({ success: false, data: null }, { status: 500 });
  });
  await assert.rejects(
    getProducts(new URLSearchParams('page=1')),
    /商品データを取得できませんでした/,
  );
  assert.equal(requests, 1);
});
