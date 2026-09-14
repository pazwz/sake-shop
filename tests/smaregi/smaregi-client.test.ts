import assert from 'node:assert/strict';
import test from 'node:test';
import { SmaregiClient } from '@/services/smaregi/smaregi-client';

const configure = () => {
  process.env.SMAREGI_ENVIRONMENT = 'sandbox';
  process.env.SMAREGI_CONTRACT_ID = 'test-contract';
  process.env.SMAREGI_CLIENT_ID = 'test-client';
  process.env.SMAREGI_CLIENT_SECRET = 'test-secret';
  process.env.SMAREGI_STORE_ID = '1';
};

const tokenResponse = () =>
  new Response(
    JSON.stringify({
      access_token: 'server-only-token',
      expires_in: 3600,
      token_type: 'Bearer',
    }),
    { status: 200 },
  );

test('caches the OAuth token and sends the minimum read scopes', async () => {
  configure();
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    if (requests.length === 1) return tokenResponse();
    return new Response('[]', { status: 200 });
  };
  const client = new SmaregiClient(fetcher, async () => undefined);

  await Promise.all([client.getStores(), client.getCategories()]);

  assert.equal(requests.filter(({ url }) => url.includes('/token')).length, 1);
  assert.equal(
    String(requests[0].init?.body),
    'grant_type=client_credentials&scope=pos.products%3Aread+pos.stock%3Aread+pos.stores%3Aread+pos.transactions%3Aread+pos.suppliers%3Aread',
  );
  assert.match(
    String(new Headers(requests[1].init?.headers).get('authorization')),
    /^Bearer /,
  );
});

test('retries 429 and 5xx with finite backoff', async () => {
  configure();
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) return tokenResponse();
    if (calls === 2)
      return new Response('{}', {
        status: 429,
        headers: { 'Retry-After': '1' },
      });
    if (calls === 3) return new Response('{}', { status: 503 });
    return new Response('[]', { status: 200 });
  };
  const delays: number[] = [];
  const client = new SmaregiClient(fetcher, async (delay) => {
    delays.push(delay);
  });

  await client.getStores();

  assert.equal(calls, 4);
  assert.deepEqual(delays, [1000, 500]);
  assert.equal(client.retryCount, 2);
});

test('does not retry authentication failures', async () => {
  configure();
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return calls === 1 ? tokenResponse() : new Response('{}', { status: 401 });
  };
  const client = new SmaregiClient(fetcher, async () => undefined);

  await assert.rejects(() => client.getStores(), { statusCode: 401 });
  assert.equal(calls, 2);
  assert.equal(client.retryCount, 0);
});

const apiProduct = (productId: string) => ({
  productId,
  categoryId: '10',
  productCode: `CODE-${productId}`,
  productName: `Product ${productId}`,
  price: '1000',
  displayFlag: '1',
  salesDivision: '0',
  division: '0',
  taxDivision: '0',
  useCategoryReduceTax: '1',
  reduceTaxId: null,
});

test('marks a Product snapshot complete only after the terminal pagination page', async () => {
  configure();
  const pageOne = Array.from({ length: 1000 }, (_, index) =>
    apiProduct(String(index + 1)),
  );
  let apiCalls = 0;
  const client = new SmaregiClient(
    async () => {
      apiCalls += 1;
      if (apiCalls === 1) return tokenResponse();
      return new Response(
        JSON.stringify(apiCalls === 2 ? pageOne : [apiProduct('1001')]),
        { status: 200 },
      );
    },
    async () => undefined,
  );

  const result = await client.getProductsSnapshot();
  assert.equal(result.complete, true);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.products.length, 1001);
  assert.equal(result.sourceIdentityCount, 1001);
});

test('pagination failure produces no complete Product snapshot', async () => {
  configure();
  const pageOne = Array.from({ length: 1000 }, (_, index) =>
    apiProduct(String(index + 1)),
  );
  let apiCalls = 0;
  const client = new SmaregiClient(
    async () => {
      apiCalls += 1;
      if (apiCalls === 1) return tokenResponse();
      if (apiCalls === 2)
        return new Response(JSON.stringify(pageOne), { status: 200 });
      return new Response('{}', { status: 503 });
    },
    async () => undefined,
  );
  await assert.rejects(() => client.getProductsSnapshot(), {
    code: 'SMAREGI_API_ERROR',
  });
});

test('timeout produces no complete Product snapshot', async () => {
  configure();
  const client = new SmaregiClient(
    async (input) => {
      if (String(input).includes('/token')) return tokenResponse();
      const error = new Error('timeout');
      error.name = 'TimeoutError';
      throw error;
    },
    async () => undefined,
  );
  await assert.rejects(() => client.getProductsSnapshot(), {
    code: 'SMAREGI_API_ERROR',
  });
});
