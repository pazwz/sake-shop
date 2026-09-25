import { z } from 'zod';

const databaseUrlSchema = z.string().url();

export type DevelopmentSeedEnvironment = {
  ALLOW_DEVELOPMENT_SEED?: string;
  DEVELOPMENT_SEED_ENV?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const databaseIdentity = (value: string) => {
  const url = new URL(value);
  return `${url.protocol}//${url.hostname}:${url.port}${url.pathname}`;
};

const isLocalDatabase = (value: string) =>
  localHostnames.has(new URL(value).hostname);

/**
 * Development fixtures are intentionally restricted to a local PostgreSQL
 * target. Remote E2E uses its own `e2e-*` fixture script instead of this
 * development dataset, so a remote database can never receive `DEV-*` rows.
 */
export const assertDevelopmentSeedTarget = (
  environment: DevelopmentSeedEnvironment = process.env,
) => {
  if (environment.ALLOW_DEVELOPMENT_SEED !== 'true')
    throw new Error('Development seed requires ALLOW_DEVELOPMENT_SEED=true.');
  if (environment.DEVELOPMENT_SEED_ENV !== 'local')
    throw new Error('Development seed requires DEVELOPMENT_SEED_ENV=local.');
  if (environment.NODE_ENV === 'production' || environment.VERCEL_ENV)
    throw new Error('Development seed is disabled outside local development.');

  const database = databaseUrlSchema.safeParse(environment.DATABASE_URL);
  const direct = databaseUrlSchema.safeParse(environment.DIRECT_URL);
  if (!database.success || !direct.success)
    throw new Error(
      'Development seed requires valid DATABASE_URL and DIRECT_URL values.',
    );
  if (databaseIdentity(database.data) !== databaseIdentity(direct.data))
    throw new Error(
      'Development seed DATABASE_URL and DIRECT_URL must target the same local database.',
    );
  if (!isLocalDatabase(database.data) || !isLocalDatabase(direct.data))
    throw new Error(
      'Development seed only permits an explicit localhost database target.',
    );

  return { target: 'local development' as const };
};
