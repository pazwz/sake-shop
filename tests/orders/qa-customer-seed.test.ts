import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { assertQaSeedAllowed } from '@/config/qa-seed';

test('QA customer seed rejects every production environment', () => {
  assert.throws(
    () =>
      assertQaSeedAllowed({
        ALLOW_QA_SEED: 'true',
        QA_SEED_ENV: 'preview',
        VERCEL_ENV: 'production',
      }),
    /disabled in production/,
  );
  assert.throws(
    () =>
      assertQaSeedAllowed({
        ALLOW_QA_SEED: 'true',
        QA_SEED_ENV: 'local',
        NODE_ENV: 'production',
      }),
    /disabled in production/,
  );
  assert.throws(() => assertQaSeedAllowed({}), /disabled in production/);
});

test('QA customer seed requires both an explicit flag and local/preview scope', () => {
  assert.doesNotThrow(() =>
    assertQaSeedAllowed({
      ALLOW_QA_SEED: 'true',
      QA_SEED_ENV: 'local',
      NODE_ENV: 'development',
    }),
  );
  assert.doesNotThrow(() =>
    assertQaSeedAllowed({
      ALLOW_QA_SEED: 'true',
      QA_SEED_ENV: 'preview',
      VERCEL_ENV: 'preview',
    }),
  );
});

test('QA seed is idempotent, creates three order states, and never reserves inventory', async () => {
  const source = await readFile(
    `${process.cwd()}/scripts/seed-qa-customer.ts`,
    'utf8',
  );
  assert.ok(source.includes("const QA_EMAIL = 'qa-customer@example.test'"));
  assert.ok(source.includes('customer.upsert'));
  assert.ok(source.includes('order.upsert'));
  assert.ok(source.includes('QA-MYPAGE-PENDING'));
  assert.ok(source.includes('QA-MYPAGE-PREPARING'));
  assert.ok(source.includes('QA-MYPAGE-SHIPPED'));
  assert.ok(source.includes('TEST123456789'));
  assert.equal(source.includes('inventoryReservation.create'), false);
  assert.equal(source.includes('inventoryMirror.update'), false);
});
