import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { logProductPrismaError } from '@/lib/product-error-logger';

const failure = () =>
  new Prisma.PrismaClientKnownRequestError(
    'Invalid invocation: email=private@example.com token=secret DATABASE_URL=postgresql://admin:password@db/private',
    {
      code: 'P2028',
      clientVersion: '6.16.0',
      meta: {
        error:
          'Transaction already closed: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 6012 ms passed since the start of the transaction. secret=hidden',
        email: 'private@example.com',
        token: 'secret',
        databaseUrl: 'postgresql://admin:password@db/private',
      },
    },
  );

test('Product Prisma diagnostics preserve transaction reason and timings without raw input or metadata', (context) => {
  const logs: string[] = [];
  context.mock.method(console, 'error', (message: string) =>
    logs.push(message),
  );
  logProductPrismaError({
    error: failure(),
    route: '/api/v1/products',
    requestId: 'request-1',
    elapsed: 6123,
  });
  assert.equal(logs.length, 1);
  const logged = JSON.parse(logs[0]);
  assert.equal(logged.code, 'P2028');
  assert.equal(
    logged.message,
    'Transaction expired before the operation completed.',
  );
  assert.deepEqual(logged.meta, { timeoutMs: 5000, elapsedMs: 6012 });
  assert.equal(logged.transaction, true);
  assert.equal(logged.route, '/api/v1/products');
  assert.equal(logged.requestId, 'request-1');
  assert.equal(logged.elapsed, 6123);
  assert.doesNotMatch(
    logs[0],
    /private|password|secret|postgres|DATABASE_URL|token|email/,
  );
});

test('Product initialization errors retain P1001 and unexpected non-Prisma errors are not serialized', (context) => {
  const logs: string[] = [];
  context.mock.method(console, 'error', (message: string) =>
    logs.push(message),
  );
  logProductPrismaError({
    error: new Prisma.PrismaClientInitializationError(
      'postgresql://admin:password@db/private',
      '6.16.0',
      'P1001',
    ),
    route: '/api/v1/products/[identifier]',
    requestId: 'request-2',
    elapsed: 5010,
  });
  logProductPrismaError({
    error: new Error('token=private'),
    route: '/api/v1/products',
    requestId: 'request-3',
    elapsed: 1,
  });
  assert.equal(logs.length, 1);
  assert.equal(JSON.parse(logs[0]).code, 'P1001');
  assert.equal(
    JSON.parse(logs[0]).message,
    'Database connection could not be established.',
  );
  assert.deepEqual(JSON.parse(logs[0]).meta, {});
  assert.doesNotMatch(logs[0], /private|password|postgres/);
});

test('Product transaction acquisition failure is distinguished from expiration without copying metadata', (context) => {
  const logs: string[] = [];
  context.mock.method(console, 'error', (message: string) =>
    logs.push(message),
  );
  const error = new Prisma.PrismaClientKnownRequestError('private invocation', {
    code: 'P2028',
    clientVersion: '6.16.0',
    meta: {
      error: 'Unable to start a transaction in the given time. token=private',
    },
  });
  logProductPrismaError({
    error,
    route: '/api/v1/products',
    requestId: 'request-4',
    elapsed: 2010,
  });
  assert.equal(logs.length, 1);
  assert.equal(
    JSON.parse(logs[0]).message,
    'Transaction could not start within the acquisition window.',
  );
  assert.deepEqual(JSON.parse(logs[0]).meta, {});
  assert.equal(JSON.parse(logs[0]).transaction, true);
  assert.doesNotMatch(logs[0], /private|token/);
});
