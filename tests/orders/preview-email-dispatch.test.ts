import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEmailDispatchTriggerConfig,
  getPublicSiteUrl,
} from '@/config/email';
import { EmailDispatchTriggerService } from '@/services/email-dispatch-trigger.service';

const token = (exp = Math.floor(Date.now() / 1000) + 3600) =>
  `test.${Buffer.from(JSON.stringify({ sub: 'owner:test:project:shop:environment:preview', exp })).toString('base64url')}.signature`;
const environment = () => ({
  VERCEL_ENV: 'preview',
  VERCEL_URL: 'current-preview.vercel.app',
  NEXT_PUBLIC_SITE_URL: 'https://old-preview.vercel.app',
  CRON_SECRET: 'test-bearer',
  VERCEL_OIDC_TOKEN: token(),
  PREVIEW_EMAIL_DISPATCH_EXPIRES_AT: new Date(
    Date.now() + 3600_000,
  ).toISOString(),
});

test('Preview derives its internal endpoint from the current deployment, not the public URL', () => {
  const env = environment();
  assert.equal(
    getEmailDispatchTriggerConfig(env).endpoint,
    'https://current-preview.vercel.app/api/v1/internal/email/process',
  );
  assert.equal(getEmailDispatchTriggerConfig(env).available, true);
  assert.equal(getPublicSiteUrl(env), 'https://old-preview.vercel.app');
});

test('an explicit current-deployment internal endpoint is accepted', () => {
  assert.equal(
    getEmailDispatchTriggerConfig({
      ...environment(),
      EMAIL_PROCESS_ENDPOINT_URL:
        'https://current-preview.vercel.app/api/v1/internal/email/process',
    }).available,
    true,
  );
});

for (const invalid of [
  'missing deployment',
  'wrong target',
  'missing bearer',
  'missing protection',
  'expired protection',
  'expired dispatch window',
] as const) {
  test(`Preview fails closed before HTTP for ${invalid}`, async () => {
    const env: Record<string, string | undefined> = environment();
    if (invalid === 'missing deployment') delete env.VERCEL_URL;
    if (invalid === 'wrong target')
      env.EMAIL_PROCESS_ENDPOINT_URL =
        'https://old-preview.vercel.app/api/v1/internal/email/process';
    if (invalid === 'missing bearer') delete env.CRON_SECRET;
    if (invalid === 'missing protection') delete env.VERCEL_OIDC_TOKEN;
    if (invalid === 'expired protection') env.VERCEL_OIDC_TOKEN = token(1);
    if (invalid === 'expired dispatch window')
      env.PREVIEW_EMAIL_DISPATCH_EXPIRES_AT = '2020-01-01T00:00:00Z';
    let calls = 0;
    const result = await new EmailDispatchTriggerService(
      async () => {
        calls++;
        return new Response();
      },
      env,
      () => undefined,
      async () => undefined,
    ).trigger('test-row');
    assert.equal(result.triggered, false);
    assert.equal(calls, 0);
  });
}

test('Preview dispatch supplies both auth layers and accepts only an application queue acknowledgment', async () => {
  const env = environment();
  let request: RequestInit | undefined;
  let reply = 'html';
  const trigger = new EmailDispatchTriggerService(
    async (url, init) => {
      assert.equal(
        url,
        'https://current-preview.vercel.app/api/v1/internal/email/process',
      );
      request = init;
      return reply === 'html'
        ? new Response('<html>Login</html>')
        : Response.json({ success: true, data: { outcome: 'QUEUED' } });
    },
    env,
    () => undefined,
    async () => undefined,
  );
  assert.equal((await trigger.trigger('test-row')).triggered, false);
  reply = 'queued';
  assert.equal((await trigger.trigger('test-row')).triggered, true);
  assert.deepEqual(request?.headers, {
    Authorization: 'Bearer test-bearer',
    'Content-Type': 'application/json',
    'x-vercel-trusted-oidc-idp-token': env.VERCEL_OIDC_TOKEN,
  });
  assert.equal(request?.redirect, 'error');
});

test('Production retains its endpoint behavior and does not read Preview credentials', async () => {
  const env = { ...environment(), VERCEL_ENV: 'production' };
  assert.equal(
    getEmailDispatchTriggerConfig({
      ...env,
      EMAIL_PROCESS_ENDPOINT_URL:
        'https://internal.example.test/api/v1/internal/email/process',
    }).endpoint,
    'https://internal.example.test/api/v1/internal/email/process',
  );
  Object.defineProperty(env, 'VERCEL_OIDC_TOKEN', {
    get: () => {
      throw new Error('Production read Preview protection');
    },
  });
  assert.equal(
    getEmailDispatchTriggerConfig(env).endpoint,
    'https://old-preview.vercel.app/api/v1/internal/email/process',
  );
  const result = await new EmailDispatchTriggerService(
    async () => new Response('', { status: 200 }),
    env,
  ).trigger('test-row');
  assert.equal(result.triggered, true);
});

test('Preview unavailable configuration reports only a safe reason', async () => {
  const env = environment();
  env.VERCEL_OIDC_TOKEN = '';
  const logs: unknown[] = [];
  await new EmailDispatchTriggerService(
    async () => { throw new Error('must not request'); }, env,
    (event) => { logs.push(event); },
  ).trigger('test-row');
  assert.deepEqual(logs, [{ event: 'email_dispatch_trigger', outcome: 'FAILED',
    code: 'PREVIEW_PROTECTION_TOKEN_MISSING', attempts: 0 }]);
});

test('Preview dispatch reads the platform request identity when the token is not an environment variable', async () => {
  const env = { ...environment(), VERCEL_OIDC_TOKEN: undefined };
  const identity = token();
  let reads = 0;
  const result = await new EmailDispatchTriggerService(
    async (_url, init) => {
      assert.equal((init?.headers as Record<string, string>)['x-vercel-trusted-oidc-idp-token'], identity);
      return Response.json({ success: true, data: { outcome: 'QUEUED' } });
    }, env, () => undefined, async () => undefined,
    () => { reads++; return identity; },
  ).trigger('test-row');
  assert.equal(result.triggered, true);
  assert.equal(reads, 1);
});
