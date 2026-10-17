import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import { getEmailDispatchTriggerConfig } from '@/config/email';
import { OperationsRunRepository } from '@/repositories/operations-run.repository';
import { EmailEventService } from '@/services/email-event.service';
import { EmailEventTransport } from '@/services/email-event-transport.service';

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === 'server-only'
      ? pathToFileURL(process.cwd() + '/node_modules/next/dist/compiled/server-only/empty.js').href
      : specifier, context);
  },
});

const endpoint = 'https://linxas-fukuoka.com/api/v1/internal/email/process';

test('Production dispatch requires the explicit stable endpoint and never falls back to public URL', () => {
  for (const target of [undefined, 'https://old.vercel.app/api/v1/internal/email/process', 'https://linxas-fukuoka.com/api/v1/internal/email/process?unsafe=1']) {
    assert.equal(getEmailDispatchTriggerConfig({ VERCEL_ENV: 'production', CRON_SECRET: 'test', NEXT_PUBLIC_SITE_URL: 'https://old.vercel.app', EMAIL_PROCESS_ENDPOINT_URL: target }).available, false);
  }
  const config = getEmailDispatchTriggerConfig({ VERCEL_ENV: 'production', CRON_SECRET: 'test', EMAIL_PROCESS_ENDPOINT_URL: endpoint, NEXT_PUBLIC_SITE_URL: 'https://old.vercel.app' });
  assert.equal(config.available, true);
  assert.equal(config.endpoint, endpoint);
});

test('health checks only Bearer and never starts operations, database work, or queue publishing', async (context) => {
  const { GET } = await import('../../app/api/v1/internal/email/health/route');
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-health-secret';
  let work = 0;
  const forbidden = async () => { work++; throw new Error('health must not process business work'); };
  context.mock.method(OperationsRunRepository.prototype, 'start', forbidden);
  context.mock.method(EmailEventService.prototype, 'handle', forbidden);
  context.mock.method(EmailEventService.prototype, 'enqueueDue', forbidden);
  context.mock.method(EmailEventTransport.prototype, 'publish', forbidden);
  context.mock.method(globalThis, 'fetch', forbidden);
  try {
    for (const [bearer, expected] of [[undefined, 401], ['Bearer wrong', 401], ['Bearer test-health-secret', 204]] as const) {
      const response = await GET(new Request(endpoint.replace('/process', '/health'), { headers: bearer ? { Authorization: bearer } : {} }));
      assert.equal(response.status, expected);
    }
    assert.equal(work, 0);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test('malformed process payloads never become pending-mail scans or operations writes', async (context) => {
  const { POST } = await import('../../app/api/v1/internal/email/process/route');
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-process-secret';
  let work = 0;
  context.mock.method(OperationsRunRepository.prototype, 'start', async () => { work++; throw new Error('unexpected business work'); });
  context.mock.method(EmailEventService.prototype, 'enqueueDue', async () => { work++; throw new Error('unexpected scan'); });
  try {
    for (const body of ['{invalid', '', 'null', '{"noop":true}', '{"event":null}', '{"outboxId":"invalid"}']) {
      const response = await POST(new Request(endpoint, { method: 'POST', headers: { Authorization: 'Bearer test-process-secret' }, body }));
      assert.equal(response.status, 422, body);
    }
    assert.equal(work, 0);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test('Production Worker auth probe calls only the stable health endpoint with Bearer', async () => {
  const { createHandler } = await import(pathToFileURL(process.cwd() + '/infrastructure/aws/email-events/index.mjs').href);
  const requests: string[] = [];
  const handler = createHandler({ environment: { EMAIL_DEPLOYMENT_ENV: 'production', EMAIL_PROCESS_ENDPOINT_URL: endpoint, CRON_SECRET_PARAMETER: '/test/secret' }, readSecret: async () => 'test-secret', request: async (url: string, init: RequestInit) => {
    requests.push(url);
    assert.equal(init.method, 'GET');
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer test-secret');
    assert.equal(init.body, undefined);
    assert.equal(init.redirect, 'error');
    return new Response(null, { status: 204 });
  } });
  assert.deepEqual(await handler({ kind: 'auth-probe' }), { outcome: 'AUTHENTICATED' });
  assert.deepEqual(requests, ['https://linxas-fukuoka.com/api/v1/internal/email/health']);
});

test('Production Worker rejects missing or old endpoints before any callback', async () => {
  const { createHandler } = await import(pathToFileURL(process.cwd() + '/infrastructure/aws/email-events/index.mjs').href);
  for (const target of [undefined, 'https://old.vercel.app/api/v1/internal/email/process']) {
    let calls = 0;
    const handler = createHandler({ environment: { EMAIL_DEPLOYMENT_ENV: 'production', EMAIL_PROCESS_ENDPOINT_URL: target, CRON_SECRET_PARAMETER: '/test/secret', NEXT_PUBLIC_SITE_URL: 'https://old.vercel.app' }, readSecret: async () => 'test', request: async () => { calls++; return new Response(null, { status: 204 }); } });
    await assert.rejects(handler({ kind: 'auth-probe' }), /EMAIL_EVENT_WORKER_NOT_CONFIGURED/);
    assert.equal(calls, 0);
  }
});

test('Worker health rejection fails closed without any process fallback', async () => {
  const { createHandler } = await import(pathToFileURL(process.cwd() + '/infrastructure/aws/email-events/index.mjs').href);
  let calls = 0;
  const handler = createHandler({ environment: { EMAIL_PROCESS_ENDPOINT_URL: endpoint, CRON_SECRET_PARAMETER: '/test/secret' }, readSecret: async () => 'wrong-secret', request: async (url: string) => {
    calls++;
    assert.equal(url, 'https://linxas-fukuoka.com/api/v1/internal/email/health');
    return new Response(null, { status: 401 });
  } });
  await assert.rejects(handler({ kind: 'auth-probe' }), /EMAIL_EVENT_AUTH_PROBE_REJECTED/);
  assert.equal(calls, 1);
});
