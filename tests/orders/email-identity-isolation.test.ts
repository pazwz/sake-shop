import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'server-only' ? pathToFileURL(process.cwd() + '/node_modules/next/dist/compiled/server-only/empty.js').href : specifier, context);
} });

test('media presigning retains its static media identity even when the email-only role is configured', async () => {
  const names = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET', 'AWS_CLOUDFRONT_DOMAIN', 'EMAIL_EVENT_APP_ROLE_ARN'];
  const before = Object.fromEntries(names.map(k => [k, process.env[k]]));
  Object.assign(process.env, { AWS_ACCESS_KEY_ID: 'AKIA_MEDIA_TEST_ONLY', AWS_SECRET_ACCESS_KEY: 'media-test-secret', AWS_REGION: 'ap-northeast-1', AWS_S3_BUCKET: 'media-test-bucket', AWS_CLOUDFRONT_DOMAIN: 'media.example.test', EMAIL_EVENT_APP_ROLE_ARN: 'arn:aws:iam::108782085732:role/sake-shop-production-email-app' });
  try {
    const { createPresignedUpload } = await import('../../lib/aws/s3');
    const result = await createPresignedUpload('uploads/test.png', 'image/png');
    const signed = new URL(result.uploadUrl);
    assert.ok(signed.searchParams.get('X-Amz-Credential')?.startsWith('AKIA_MEDIA_TEST_ONLY/'));
    assert.equal(signed.searchParams.has('X-Amz-Security-Token'), false);
    assert.equal(result.url, 'https://media.example.test/uploads/test.png');
    assert.equal(process.env.AWS_ACCESS_KEY_ID, 'AKIA_MEDIA_TEST_ONLY');
  } finally {
    for (const key of names) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  }
});

test('Production OIDC trust accepts only the exact team audience and project production subject', async () => {
  const trust = JSON.parse(await readFile('infrastructure/aws/email-events/production-app-trust.json', 'utf8'));
  const conditions = trust.Statement[0].Condition.StringEquals as Record<string, string>;
  const accepted = (aud: string, sub: string) => Object.entries(conditions).every(([key, value]) => ({ 'oidc.vercel.com/latte-moca:aud': aud, 'oidc.vercel.com/latte-moca:sub': sub })[key as 'oidc.vercel.com/latte-moca:aud'] === value);
  assert.equal(accepted('https://vercel.com/latte-moca', 'owner:latte-moca:project:sake-shop:environment:production'), true);
  for (const sub of ['owner:latte-moca:project:sake-shop:environment:preview', 'owner:latte-moca:project:sake-shop:environment:development', 'owner:latte-moca:project:other-project:environment:production'])
    assert.equal(accepted('https://vercel.com/latte-moca', sub), false);
  assert.equal(accepted('https://vercel.com/other-team', 'owner:latte-moca:project:sake-shop:environment:production'), false);
});

test('identity route refuses missing auth and Preview before constructing AWS clients', async () => {
  const { POST, DELETE } = await import('../../app/api/v1/internal/email/identity/route');
  const before = { CRON_SECRET: process.env.CRON_SECRET, VERCEL_ENV: process.env.VERCEL_ENV };
  process.env.CRON_SECRET = 'identity-test';
  try {
    const request = (auth?: string) => new Request('https://linxas-fukuoka.com/api/v1/internal/email/identity', { method: 'POST', headers: auth ? { Authorization: auth } : {}, body: '{"action":"create-disabled-schedule"}' });
    assert.equal((await POST(request())).status, 401);
    assert.equal((await POST(request('Bearer wrong'))).status, 401);
    process.env.VERCEL_ENV = 'preview';
    assert.equal((await POST(request('Bearer identity-test'))).status, 403);
    process.env.VERCEL_ENV = 'production';
    const invalid = new Request('https://linxas-fukuoka.com/api/v1/internal/email/identity', { method: 'DELETE', headers: { Authorization: 'Bearer identity-test' }, body: '{"name":"email-real-campaign"}' });
    assert.equal((await DELETE(invalid)).status, 422);
  } finally {
    for (const key of ['CRON_SECRET', 'VERCEL_ENV'] as const) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
  }
});
