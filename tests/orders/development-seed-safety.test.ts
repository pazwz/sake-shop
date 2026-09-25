import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { assertDevelopmentSeedTarget } from '@/config/development-seed';

const localEnvironment = {
  ALLOW_DEVELOPMENT_SEED: 'true',
  DEVELOPMENT_SEED_ENV: 'local',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/sake_shop_dev',
  DIRECT_URL: 'postgresql://user:password@localhost:5432/sake_shop_dev',
  NODE_ENV: 'development',
} as const;

test('development seed requires an explicit allow flag', () => {
  assert.throws(
    () =>
      assertDevelopmentSeedTarget({
        ...localEnvironment,
        ALLOW_DEVELOPMENT_SEED: undefined,
      }),
    /ALLOW_DEVELOPMENT_SEED=true/,
  );
});

test('development seed rejects production and unknown database targets', () => {
  assert.throws(
    () =>
      assertDevelopmentSeedTarget({
        ...localEnvironment,
        DATABASE_URL:
          'postgresql://user:password@production.example.test:5432/sake_shop',
        DIRECT_URL:
          'postgresql://user:password@production.example.test:5432/sake_shop',
      }),
    /localhost database target/,
  );
  assert.throws(
    () => assertDevelopmentSeedTarget({ ...localEnvironment, NODE_ENV: 'production' }),
    /disabled outside local development/,
  );
  assert.throws(
    () => assertDevelopmentSeedTarget({ ...localEnvironment, DATABASE_URL: undefined }),
    /DATABASE_URL and DIRECT_URL/,
  );
});

test('development seed permits only an explicitly allowed local target', () => {
  assert.deepEqual(assertDevelopmentSeedTarget(localEnvironment), {
    target: 'local development',
  });
});

test('remote E2E fixtures cannot import development seed identities', async () => {
  const source = await readFile(
    `${process.cwd()}/scripts/seed-e2e-fixtures.ts`,
    'utf8',
  );
  assert.equal(source.includes('developmentSeedProducts'), false);
  assert.equal(source.includes('dev-smaregi-'), false);
  assert.equal(source.includes('DEV-'), false);
  assert.match(source, /e2e-smaregi-product-001/);
});
