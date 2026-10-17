import assert from 'node:assert/strict';
import test from 'node:test';
import { getEmailAwsClientConfig } from '@/lib/aws/email-event-client';

const role = 'arn:aws:iam::108782085732:role/sake-shop-production-email-app';
const temporary = { accessKeyId: 'ASIA-test-email', secretAccessKey: 'test-only', sessionToken: 'test-only', expiration: new Date(Date.now() + 60_000) };

test('Production Email clients explicitly resolve the email-only role, ignoring media credentials', async () => {
  const env = { VERCEL_ENV: 'production', EMAIL_EVENT_APP_ROLE_ARN: role, AWS_ACCESS_KEY_ID: 'media-key', AWS_SECRET_ACCESS_KEY: 'media-secret', AWS_REGION: 'ap-northeast-1' };
  const before = { ...env };
  let selected: unknown;
  const config = getEmailAwsClientConfig(env, (options) => { selected = options; return async () => temporary; });
  assert.equal(typeof config.credentials, 'function');
  assert.deepEqual(await config.credentials!(), temporary);
  assert.deepEqual(selected, { roleArn: role, durationSeconds: 900, clientConfig: { region: 'ap-northeast-1' } });
  assert.deepEqual(env, before);
});

test('Production fails closed instead of falling back to media or administrator credentials', () => {
  for (const value of [undefined, 'arn:aws:iam::108782085732:role/sake-shop-preview-email-app', 'arn:aws:iam::108782085732:user/sake-shop-admin']) {
    assert.throws(() => getEmailAwsClientConfig({ VERCEL_ENV: 'production', EMAIL_EVENT_APP_ROLE_ARN: value, AWS_ACCESS_KEY_ID: 'media-key' }), /EMAIL_EVENT_IDENTITY_NOT_CONFIGURED/);
  }
});

test('Preview cannot select the Production Email role; existing Preview credentials remain isolated', () => {
  assert.throws(() => getEmailAwsClientConfig({ VERCEL_ENV: 'preview', EMAIL_EVENT_APP_ROLE_ARN: role }), /EMAIL_EVENT_IDENTITY_FORBIDDEN/);
  assert.deepEqual(getEmailAwsClientConfig({ VERCEL_ENV: 'preview', AWS_ACCESS_KEY_ID: 'preview-sts' }), {});
});
