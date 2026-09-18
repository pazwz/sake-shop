const productionHosts = new Set([
  'sake-shop.vercel.app',
  'linxas-fukuoka.com',
]);

const baseURL = () => process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export const isProductionE2ETarget = () => {
  const host = new URL(baseURL()).hostname;
  return process.env.VERCEL_ENV === 'production' || productionHosts.has(host);
};

export const mutationSuiteEnabled = () =>
  !isProductionE2ETarget() && process.env.E2E_ALLOW_MUTATIONS === 'true';

export const requireNonProductionMutationEnvironment = () => {
  if (isProductionE2ETarget())
    throw new Error('E2E_MUTATION_FORBIDDEN_IN_PRODUCTION');
  if (process.env.E2E_ALLOW_MUTATIONS !== 'true')
    throw new Error('E2E_MUTATIONS_REQUIRE_E2E_ALLOW_MUTATIONS');
};

export const productionSmokeEnabled = () =>
  isProductionE2ETarget() && process.env.E2E_PRODUCTION_SMOKE === 'true';
