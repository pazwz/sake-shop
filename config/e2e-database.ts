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
