import { PaymentProvider } from '@prisma/client';
import { MockPaymentAdapter } from './mock-payment.adapter';
import type { PaymentProviderAdapter } from './payment-provider.adapter';

// Real STERA, PAYPAY, and STRIPE adapters intentionally remain unconfigured
// stubs until provider credentials and production contracts are approved.
export const getPaymentAdapter = (
  _provider: PaymentProvider,
): PaymentProviderAdapter => new MockPaymentAdapter();
