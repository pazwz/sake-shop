import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const endpoint =
  'https://isolated-preview.vercel.app/api/v1/internal/email/process';
const event = {
  Records: [
    { messageId: 'probe', body: '{"kind":"outbox","outboxId":"test-id"}' },
  ],
};
const bundle = () => ({
  kind: 'preview',
  endpoint,
  secret: 'test-cron',
  protectionCookie: '_vercel_jwt=test-access',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});
const load = () =>
  import(
    pathToFileURL(process.cwd() + '/infrastructure/aws/email-events/index.mjs')
      .href
  );

test('Preview Worker rejects a plain secret without deployment protection', async () => {
  const { createHandler } = await load();
  const handler = createHandler({
    environment: {
      EMAIL_DEPLOYMENT_ENV: 'preview',
      EMAIL_PROCESS_ENDPOINT_URL: endpoint,
      CRON_SECRET_PARAMETER: '/preview/auth',
    },
    readSecret: async () => 'plain-secret',
    request: async () => { throw new Error('must not request'); },
  });
  await assert.rejects(handler(event), /EMAIL_EVENT_PREVIEW_AUTH_INVALID/);
});

test('Preview Worker sends deployment-bound access and application auth without following redirects', async () => {
  const { createHandler } = await load();
  const requests: RequestInit[] = [];
  const handler = createHandler({
    environment: {
      EMAIL_DEPLOYMENT_ENV: 'preview',
      EMAIL_PROCESS_ENDPOINT_URL: endpoint,
      CRON_SECRET_PARAMETER: '/preview/auth',
    },
    readSecret: async () => JSON.stringify(bundle()),
    request: async (url: string, init: RequestInit) => {
      assert.equal(url, endpoint);
      requests.push(init);
      return new Response(
        JSON.stringify({ success: true, data: { outcome: 'SUCCESS' } }),
      );
    },
  });
  assert.deepEqual(await handler(event), { batchItemFailures: [] });
  assert.deepEqual(requests[0].headers, {
    Authorization: 'Bearer test-cron',
    'Content-Type': 'application/json',
    Cookie: '_vercel_jwt=test-access',
  });
  assert.equal(requests[0].redirect, 'error');
});

for (const invalid of [
  'expired',
  'different deployment',
  'missing bearer',
  'missing protection',
  'production',
] as const) {
  test(`Preview Worker refuses ${invalid} access before making a request`, async () => {
    const { createHandler } = await load();
    const auth = bundle();
    if (invalid === 'expired') auth.expiresAt = '2020-01-01T00:00:00Z';
    if (invalid === 'different deployment')
      auth.endpoint =
        'https://other-preview.vercel.app/api/v1/internal/email/process';
    if (invalid === 'missing bearer') auth.secret = '';
    if (invalid === 'missing protection') auth.protectionCookie = '';
    let calls = 0;
    const handler = createHandler({
      environment: {
        EMAIL_DEPLOYMENT_ENV:
          invalid === 'production' ? 'production' : 'preview',
        EMAIL_PROCESS_ENDPOINT_URL: endpoint,
        CRON_SECRET_PARAMETER: '/preview/auth',
      },
      readSecret: async () => JSON.stringify(auth),
      request: async () => {
        calls++;
        throw new Error('must not request');
      },
    });
    await assert.rejects(handler(event), /EMAIL_EVENT_PREVIEW_AUTH_INVALID/);
    assert.equal(calls, 0);
  });
}
