import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getSafeE2EDatabaseEnvironment,
  getSafeE2EDatabasePreparationEnvironment,
} from '../../config/e2e-database';

test('local E2E requires an explicit isolated database URL', () => {
  assert.throws(
    () => getSafeE2EDatabaseEnvironment({}),
    /E2E_DATABASE_URL is required/,
  );
});

test('local E2E rejects the configured default database', () => {
  assert.throws(
    () =>
      getSafeE2EDatabaseEnvironment({
        DATABASE_URL: 'postgresql://user:password@production.example.test:5432/app',
        E2E_DATABASE_URL:
          'postgresql://other:password@production-pooler.example.test:5432/app',
        E2E_DIRECT_URL:
          'postgresql://other:password@test.example.test:5432/e2e',
      }),
    /(matches DATABASE_URL|same database branch)/,
  );
});

test('local E2E rejects a direct URL that targets the configured default database', () => {
  assert.throws(
    () =>
      getSafeE2EDatabaseEnvironment({
        DATABASE_URL: 'postgresql://user:password@production.example.test:5432/app',
        E2E_DATABASE_URL:
          'postgresql://user:password@test-pooler.example.test:5432/e2e',
        E2E_DIRECT_URL:
          'postgresql://other:password@production.example.test:5432/app',
      }),
    /(E2E_DIRECT_URL matches DATABASE_URL|same database branch)/,
  );
});

test('local E2E requires a direct URL instead of falling back to the pooled URL', () => {
  assert.throws(
    () =>
      getSafeE2EDatabaseEnvironment({
        E2E_DATABASE_URL:
          'postgresql://user:password@test-pooler.example.test:5432/e2e',
      }),
    /E2E_DIRECT_URL is required/,
  );
});

test('local E2E requires a pooled runtime URL and an unpooled direct preparation URL', () => {
  assert.throws(
    () =>
      getSafeE2EDatabaseEnvironment({
        E2E_DATABASE_URL: 'postgresql://user:password@test.example.test:5432/e2e',
        E2E_DIRECT_URL:
          'postgresql://user:password@test-pooler.example.test:5432/e2e',
      }),
    /E2E_DATABASE_URL must use the pooled endpoint/,
  );
  assert.throws(
    () =>
      getSafeE2EDatabaseEnvironment({
        E2E_DATABASE_URL:
          'postgresql://user:password@test-pooler.example.test:5432/e2e',
        E2E_DIRECT_URL:
          'postgresql://user:password@test-pooler.example.test:5432/e2e',
      }),
    /E2E_DIRECT_URL must not use a pooled endpoint/,
  );
});

test('preparation uses the direct URL while runtime uses the pooled URL', () => {
  const input = {
    DATABASE_URL: 'postgresql://user:password@production-pooler.example.test:5432/app',
    E2E_DATABASE_URL:
      'postgresql://user:password@test-pooler.example.test:5432/e2e',
    E2E_DIRECT_URL: 'postgresql://user:password@test.example.test:5432/e2e',
  };
  const environment = getSafeE2EDatabaseEnvironment({
    ...input,
  });
  const preparation = getSafeE2EDatabasePreparationEnvironment(input);

  assert.equal(
    environment.databaseUrl,
    input.E2E_DATABASE_URL,
  );
  assert.equal(environment.directUrl, input.E2E_DIRECT_URL);
  assert.equal(preparation.databaseUrl, input.E2E_DIRECT_URL);
  assert.equal(preparation.directUrl, input.E2E_DIRECT_URL);
});

test('local E2E rejects pooled and direct URLs that identify the default database', () => {
  assert.throws(
    () =>
      getSafeE2EDatabaseEnvironment({
        DATABASE_URL:
          'postgresql://user:password@production-pooler.example.test:5432/app',
        E2E_DATABASE_URL:
          'postgresql://user:password@e2e-pooler.example.test:5432/e2e',
        E2E_DIRECT_URL:
          'postgresql://user:password@production.example.test:5432/app',
      }),
    /(E2E_DIRECT_URL matches DATABASE_URL|same database branch)/,
  );
});
