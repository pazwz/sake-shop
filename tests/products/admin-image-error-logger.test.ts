import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { logAdminImageError } from '@/lib/admin-image-error-logger';

test('image diagnostics retain stage and database code without raw message, metadata or URLs', (context) => {
  const logs: string[] = [];
  context.mock.method(console, 'error', (value: string) => logs.push(value));
  const error = new Prisma.PrismaClientKnownRequestError(
    'https://private.example/?X-Amz-Signature=secret-value',
    {
      code: 'P1001',
      clientVersion: '6.16.0',
      meta: { email: 'private@example.test', password: 'secret-value' },
    },
  );
  logAdminImageError('save', error);
  const result = JSON.parse(logs[0]);
  assert.equal(result.stage, 'save');
  assert.equal(result.route, '/api/v1/admin/products/[id]/images');
  assert.equal(result.code, 'P1001');
  assert.equal(typeof result.requestId, 'string');
  assert.doesNotMatch(
    logs[0],
    /private|secret-value|X-Amz|https:|password|email/,
  );
});

test('unexpected presign errors are logged without arbitrary error name or body', (context) => {
  const logs: string[] = [];
  context.mock.method(console, 'error', (value: string) => logs.push(value));
  const error = new Error('DATABASE_URL=private-secret');
  error.name = 'private-secret';
  logAdminImageError('presign', error);
  const result = JSON.parse(logs[0]);
  assert.equal(result.stage, 'presign');
  assert.equal(result.errorName, 'Error');
  assert.equal(result.code, null);
  assert.doesNotMatch(logs[0], /private-secret|DATABASE_URL/);
});

test('missing storage configuration names the missing setting without a value', (context) => {
  const logs: string[] = [];
  context.mock.method(console, 'error', (value: string) => logs.push(value));
  logAdminImageError(
    'presign',
    new Error('AWS_S3_BUCKET is required for AWS S3 storage.'),
  );
  const result = JSON.parse(logs[0]);
  assert.equal(result.code, 'STORAGE_CONFIGURATION_MISSING');
  assert.equal(result.missingConfiguration, 'AWS_S3_BUCKET');
});
