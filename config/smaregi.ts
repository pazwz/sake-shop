import { AppError } from '@/lib/errors';
import {
  smaregiApiEnvironmentSchema,
  smaregiEnvironmentSchema,
} from '@/config/env';

export const SMAREGI_SYSTEM = 'SMAREGI';
export const SMAREGI_CONTRACT_EVENT = 'AppSubscription';
export const SMAREGI_CONTRACT_ENTITY_TYPE = 'APP_SUBSCRIPTION';
export const SMAREGI_CONTRACT_ACTIONS = [
  'start',
  'end',
  'change-plan',
  'change-options',
  'force-stop',
  'cancel-force-stop',
] as const;
export const SMAREGI_READ_SCOPES = [
  'pos.products:read',
  'pos.stock:read',
  'pos.stores:read',
  'pos.transactions:read',
  'pos.suppliers:read',
] as const;
export const SMAREGI_PAGE_SIZE = 1000;
export const SMAREGI_REQUEST_TIMEOUT_MS = 10_000;
export const SMAREGI_MAX_RETRIES = 3;
export const SMAREGI_TOKEN_EXPIRY_BUFFER_MS = 60_000;
export const SMAREGI_APPROVED_STORE_IDS = ['1', '2', '3', '6'] as const;
export const SMAREGI_PRIMARY_STORE_ID = '1';
export const SMAREGI_BOX_PRODUCT_IDS = [
  '8000570',
  '8000571',
  '8000572',
  '8000573',
  '8000574',
  '8000575',
] as const;

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

export const getSmaregiApiEnvironment = () => {
  const parsed = smaregiApiEnvironmentSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new AppError(
      'Smaregi API credentials are not configured.',
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
