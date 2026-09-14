export type QaSeedEnvironment = {
  ALLOW_QA_SEED?: string;
  QA_SEED_ENV?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
};

export const assertQaSeedAllowed = (
  environment: QaSeedEnvironment = process.env,
) => {
  if (
    environment.ALLOW_QA_SEED !== 'true' ||
    !['local', 'preview'].includes(environment.QA_SEED_ENV ?? '') ||
    environment.VERCEL_ENV === 'production' ||
    environment.NODE_ENV === 'production'
  )
    throw new Error('QA seed is disabled in production.');
};
