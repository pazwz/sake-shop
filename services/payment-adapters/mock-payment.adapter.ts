import { randomUUID } from 'crypto';
import type {
  PaymentProviderAdapter,
  PaymentCreation,
  PaymentWebhook,
} from './payment-provider.adapter';

export const MOCK_WEBHOOK_SIGNATURE = 'mock-development-signature';

export class MockPaymentAdapter implements PaymentProviderAdapter {
  async createPayment(input: PaymentCreation) {
    return {
      providerPaymentId: `mock-${input.provider.toLowerCase()}-${randomUUID()}`,
      amount: input.amount,
    };
  }

  async verifyWebhookSignature(
    _input: PaymentWebhook,
    signature: string | null,
  ) {
    return (
      process.env.NODE_ENV !== 'production' &&
      signature === MOCK_WEBHOOK_SIGNATURE
    );
  }
}
