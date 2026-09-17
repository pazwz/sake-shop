import { randomUUID } from 'crypto';
import type { CheckoutEnvironment } from '@/config/checkout';
import { CheckoutAccessService } from '@/services/checkout-access.service';
import type {
  PaymentProviderAdapter,
  PaymentCreation,
  PaymentWebhookRequest,
  ProviderPaymentOutcome,
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
      outcome: 'SUCCEEDED' as const,
      amount: input.amount,
      currency: input.currency,
    };
  }

  async verifyWebhookSignature(
    _input: PaymentWebhookRequest,
    signature: string | null,
  ) {
    this.checkoutAccess.assertMockPaymentAllowed();
    return signature === MOCK_WEBHOOK_SIGNATURE;
  }

  normalizeWebhook(input: PaymentWebhookRequest) {
    const outcomes: Partial<Record<typeof input.status, ProviderPaymentOutcome>> = {
      SUCCEEDED: 'SUCCEEDED',
      FAILED: 'FAILED',
      CANCELLED: 'CANCELLED',
      REFUNDED: 'REFUNDED',
    };
    const outcome = outcomes[input.status];
    if (!outcome) throw new Error('MOCK_WEBHOOK_STATUS_UNSUPPORTED');
    return {
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      eventId: input.eventId,
      eventType: `mock.payment.${input.status.toLowerCase()}`,
      outcome,
      amount: input.amount,
      currency: input.currency,
    };
  }

  async getPaymentStatus(input: { providerPaymentId: string }) {
    this.checkoutAccess.assertMockPaymentAllowed();
    return {
      providerPaymentId: input.providerPaymentId,
      outcome: 'SUCCEEDED' as const,
      amount: 0,
      currency: 'JPY' as const,
    };
  }

  async cancelPayment(input: { providerPaymentId: string }) {
    this.checkoutAccess.assertMockPaymentAllowed();
    return {
      providerPaymentId: input.providerPaymentId,
      outcome: 'CANCELLED' as const,
      amount: 0,
      currency: 'JPY' as const,
    };
  }

  async refundPayment(input: { providerPaymentId: string }) {
    this.checkoutAccess.assertMockPaymentAllowed();
    return {
      providerPaymentId: input.providerPaymentId,
      outcome: 'REFUNDED' as const,
      amount: 0,
      currency: 'JPY' as const,
    };
  }
}
