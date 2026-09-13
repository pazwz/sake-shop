import { checkoutModeSchema, type CheckoutMode } from '@/config/env';

export type CheckoutDeployment = 'local' | 'preview' | 'production';

export type CheckoutRuntimeState = {
  deployment: CheckoutDeployment;
  requestedMode: CheckoutMode | null;
  effectiveMode: 'mock' | 'disabled';
  checkoutEnabled: boolean;
  mockPaymentEnabled: boolean;
  reason:
    | 'MOCK_ENABLED'
    | 'CHECKOUT_DISABLED'
    | 'MODE_MISSING'
    | 'MODE_INVALID'
    | 'MOCK_FORBIDDEN_IN_PRODUCTION'
    | 'LIVE_PAYMENT_UNAVAILABLE';
};

export type CheckoutEnvironment = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  CHECKOUT_MODE?: string;
};

const getCheckoutDeployment = (
  environment: CheckoutEnvironment,
): CheckoutDeployment => {
  if (environment.VERCEL_ENV === 'production') return 'production';
  if (environment.VERCEL_ENV === 'preview') return 'preview';
  if (environment.NODE_ENV === 'production') return 'production';
  return 'local';
};

export const getCheckoutRuntimeState = (
  environment: CheckoutEnvironment = process.env,
): CheckoutRuntimeState => {
  const deployment = getCheckoutDeployment(environment);
  const parsedMode = checkoutModeSchema.safeParse(environment.CHECKOUT_MODE);
  const requestedMode = parsedMode.success ? parsedMode.data : null;

  if (requestedMode === 'live') {
    return {
      deployment,
      requestedMode,
      effectiveMode: 'disabled',
      checkoutEnabled: false,
      mockPaymentEnabled: false,
      reason: 'LIVE_PAYMENT_UNAVAILABLE',
    };
  }

  if (requestedMode === 'mock') {
    const mockPaymentEnabled = deployment !== 'production';
    return {
      deployment,
      requestedMode,
      effectiveMode: mockPaymentEnabled ? 'mock' : 'disabled',
      checkoutEnabled: mockPaymentEnabled,
      mockPaymentEnabled,
      reason: mockPaymentEnabled
        ? 'MOCK_ENABLED'
        : 'MOCK_FORBIDDEN_IN_PRODUCTION',
    };
  }

  if (requestedMode === 'disabled') {
    return {
      deployment,
      requestedMode,
      effectiveMode: 'disabled',
      checkoutEnabled: false,
      mockPaymentEnabled: false,
      reason: 'CHECKOUT_DISABLED',
    };
  }

  if (deployment === 'local' && environment.CHECKOUT_MODE === undefined) {
    return {
      deployment,
      requestedMode,
      effectiveMode: 'mock',
      checkoutEnabled: true,
      mockPaymentEnabled: true,
      reason: 'MOCK_ENABLED',
    };
  }

  return {
    deployment,
    requestedMode,
    effectiveMode: 'disabled',
    checkoutEnabled: false,
    mockPaymentEnabled: false,
    reason:
      environment.CHECKOUT_MODE === undefined
        ? 'MODE_MISSING'
        : 'MODE_INVALID',
  };
};
