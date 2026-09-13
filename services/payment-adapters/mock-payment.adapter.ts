import { randomUUID } from 'crypto';
import type { CheckoutEnvironment } from '@/config/checkout';
import { CheckoutAccessService } from '@/services/checkout-access.service';
import type {
  PaymentProviderAdapter,
  PaymentCreation,
  PaymentWebhook,
} from './payment-provider.adapter';

export const MOCK_WEBHOOK_SIGNATURE = 'mock-development-signature';

export class MockPaymentAdapter implements PaymentProviderAdapter {
  private readonly checkoutAccess: CheckoutAccessService;

  public constructor(environment: CheckoutEnvironment = process.env) {
    this.checkoutAccess = new CheckoutAccessService(environment);
  }

  async createPayment(input: PaymentCreation) {
    this.checkoutAccess.assertMockPaymentAllowed();
    return {
      providerPaymentId: `mock-${input.provider.toLowerCase()}-${randomUUID()}`,
      amount: input.amount,
    };
  }

  async verifyWebhookSignature(
    _input: PaymentWebhook,
    signature: string | null,
  ) {
    this.checkoutAccess.assertMockPaymentAllowed();
    return signature === MOCK_WEBHOOK_SIGNATURE;
  }
}
