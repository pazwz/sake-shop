import { Prisma } from '@prisma/client';

type ProductErrorContext = {
  route: '/api/v1/products' | '/api/v1/products/[identifier]';
  requestId: string;
  elapsed: number;
  error: unknown;
};

export const logProductPrismaError = (input: ProductErrorContext) => {
  const error = input.error;
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) &&
    !(error instanceof Prisma.PrismaClientInitializationError) &&
    !(error instanceof Prisma.PrismaClientUnknownRequestError)
  )
    return;

  const rawCode =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : error instanceof Prisma.PrismaClientInitializationError
        ? error.errorCode
        : null;
  const code = rawCode && /^P\d{4}$/.test(rawCode) ? rawCode : null;
  const reason =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    typeof error.meta?.error === 'string'
      ? error.meta.error
      : error.message;

  // Lossy allowlist: never serialize invocation text, arbitrary metadata or stack.
  let message = 'Product database operation failed.';
  const meta: { timeoutMs?: number; elapsedMs?: number } = {};
  if (code === 'P1001')
    message = 'Database connection could not be established.';
  if (code === 'P2028') {
    message = 'Transaction operation failed.';
    if (reason.includes('Unable to start a transaction in the given time')) {
      message = 'Transaction could not start within the acquisition window.';
    } else if (reason.includes('expired transaction')) {
      message = 'Transaction expired before the operation completed.';
      const timeout = reason.match(/timeout for this transaction was (\d+) ms/);
      const elapsed = reason.match(/(\d+) ms passed since the start/);
      if (timeout && Number.isSafeInteger(Number(timeout[1])))
        meta.timeoutMs = Number(timeout[1]);
      if (elapsed && Number.isSafeInteger(Number(elapsed[1])))
        meta.elapsedMs = Number(elapsed[1]);
    } else if (reason.includes('Transaction already closed')) {
      message = 'Transaction was already closed.';
    }
  }

  console.error(
    JSON.stringify({
      level: 'error',
      code,
      message,
      meta,
      route: input.route,
      requestId: input.requestId,
      elapsed: Math.round(input.elapsed),
      // Indicates transaction evidence in the error, not merely the route's capability.
      transaction:
        code === 'P2028' ||
        Boolean(error.stack?.includes('_transactionWithCallback')),
    }),
  );
};
