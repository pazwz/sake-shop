import { z } from 'zod';

const databaseUrlSchema = z.string().url();

type E2EDatabaseEnvironment = {
  E2E_DATABASE_URL?: string;
  E2E_DIRECT_URL?: string;
  DATABASE_URL?: string;
};

const databaseIdentity = (value: string) => {
  const url = new URL(value);
  const hostname = url.hostname.replace(/-pooler(?=\.|$)/, '');
  return `${url.protocol}//${hostname}:${url.port}${url.pathname}`;
};

const hostname = (value: string) => new URL(value).hostname;

const branchIdentity = (value: string) =>
  hostname(value).replace(/-pooler(?=\.|$)/, '');

const isPooledEndpoint = (value: string) => hostname(value).includes('-pooler');

export const getSafeE2EDatabaseEnvironment = (
  environment: E2EDatabaseEnvironment = process.env as E2EDatabaseEnvironment,
) => {
  const parsed = databaseUrlSchema.safeParse(environment.E2E_DATABASE_URL);
  if (!parsed.success)
    throw new Error(
      'E2E_DATABASE_URL is required. Refusing to run local E2E against the default database.',
    );
  const direct = databaseUrlSchema.safeParse(environment.E2E_DIRECT_URL);
  if (!direct.success)
    throw new Error(
      'E2E_DIRECT_URL is required and must be a valid database URL. Refusing to prepare or run local E2E without an isolated direct connection.',
    );
  if (!isPooledEndpoint(parsed.data))
    throw new Error(
      'E2E_DATABASE_URL must use the pooled endpoint. Refusing to run the application runtime against a direct connection.',
    );
  if (isPooledEndpoint(direct.data))
    throw new Error(
      'E2E_DIRECT_URL must not use a pooled endpoint. Refusing to prepare the test database through a pooler.',
    );
  if (branchIdentity(parsed.data) !== branchIdentity(direct.data))
    throw new Error(
      'E2E pooled and direct URLs must target the same database branch.',
    );
  const current = environment.DATABASE_URL
    ? databaseUrlSchema.safeParse(environment.DATABASE_URL)
    : null;
  if (
    current?.success &&
    databaseIdentity(current.data) === databaseIdentity(parsed.data)
  )
    throw new Error(
      'E2E_DATABASE_URL matches DATABASE_URL. Refusing to run E2E against the default database.',
    );
  if (
    current?.success &&
    databaseIdentity(current.data) === databaseIdentity(direct.data)
  )
    throw new Error(
      'E2E_DIRECT_URL matches DATABASE_URL. Refusing to prepare the default database.',
    );
  return {
    databaseUrl: parsed.data,
    directUrl: direct.data,
  };
};

/**
 * Prisma migrations and seeds must use the direct test-branch connection.
 * The application runtime intentionally continues to use the pooled URL.
 */
export const getSafeE2EDatabasePreparationEnvironment = (
  environment: E2EDatabaseEnvironment = process.env as E2EDatabaseEnvironment,
) => {
  const runtime = getSafeE2EDatabaseEnvironment(environment);
  return {
    databaseUrl: runtime.directUrl,
    directUrl: runtime.directUrl,
  };
};
