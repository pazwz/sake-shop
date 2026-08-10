import { AppError } from '@/lib/errors';
import { smaregiEnvironmentSchema } from '@/config/env';

export const SMAREGI_SYSTEM = 'SMAREGI';
export const SMAREGI_READ_SCOPES = [
  'pos.products:read',
  'pos.stock:read',
  'pos.stores:read',
] as const;
export const SMAREGI_PAGE_SIZE = 1000;
export const SMAREGI_REQUEST_TIMEOUT_MS = 10_000;
export const SMAREGI_MAX_RETRIES = 3;
export const SMAREGI_TOKEN_EXPIRY_BUFFER_MS = 60_000;
export const STANDARD_TAX_RATE_PERCENT = 10;

export const getSmaregiConfigurationStatus = () => ({
  environment: process.env.SMAREGI_ENVIRONMENT ?? 'sandbox',
  contractConfigured: Boolean(process.env.SMAREGI_CONTRACT_ID),
  clientConfigured: Boolean(
    process.env.SMAREGI_CLIENT_ID && process.env.SMAREGI_CLIENT_SECRET,
  ),
  storeId: process.env.SMAREGI_STORE_ID ?? null,
});

export const getSmaregiEnvironment = () => {
  const parsed = smaregiEnvironmentSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new AppError(
      'Smaregi integration is not configured.',
      'SMAREGI_NOT_CONFIGURED',
      503,
    );
  }
  return parsed.data;
};

export const getSmaregiBaseUrl = (environment: 'sandbox' | 'production') =>
  environment === 'sandbox'
    ? 'https://api.smaregi.dev'
    : 'https://api.smaregi.jp';

export const getSmaregiIdentityUrl = (environment: 'sandbox' | 'production') =>
  environment === 'sandbox'
    ? 'https://id.smaregi.dev'
    : 'https://id.smaregi.jp';
