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

  await client.getStores();
  await client.getCategories();

  assert.equal(requests.filter(({ url }) => url.includes('/token')).length, 1);
  assert.equal(
    String(requests[0].init?.body),
    'grant_type=client_credentials&scope=pos.products%3Aread+pos.stock%3Aread+pos.stores%3Aread',
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
