import { PaymentProvider } from '@prisma/client';
import type { CheckoutEnvironment } from '@/config/checkout';
import { CheckoutAccessService } from '@/services/checkout-access.service';
import { MockPaymentAdapter } from './mock-payment.adapter';
import type { PaymentProviderAdapter } from './payment-provider.adapter';

// Real STERA, PAYPAY, and STRIPE adapters intentionally remain unconfigured
// stubs until provider credentials and production contracts are approved.
export const getPaymentAdapter = (
  _provider: PaymentProvider,
  environment: CheckoutEnvironment = process.env,
): PaymentProviderAdapter => {
  new CheckoutAccessService(environment).assertMockPaymentAllowed();
  return new MockPaymentAdapter(environment);
};
