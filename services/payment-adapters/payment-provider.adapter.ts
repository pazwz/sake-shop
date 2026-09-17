import { PaymentProvider, PaymentStatus } from '@prisma/client';

export const PAYMENT_CURRENCY = 'JPY' as const;
export type PaymentCurrency = typeof PAYMENT_CURRENCY;

/**
 * Provider-neutral outcomes. Provider-specific status strings must be mapped by
 * an adapter and must never be written directly to LINXAS PaymentStatus.
 */
export type ProviderPaymentOutcome =
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentCreation = {
  provider: PaymentProvider;
  orderNumber: string;
  amount: number;
  currency: PaymentCurrency;
};

export type PaymentWebhookRequest = {
  provider: PaymentProvider;
  providerPaymentId: string;
  eventId: string;
  /** Mock-only transport status. A real adapter owns its raw payload schema. */
  status: PaymentStatus;
  amount: number;
  currency: PaymentCurrency;
};

export type VerifiedPaymentWebhook = {
  provider: PaymentProvider;
  providerPaymentId: string;
  eventId: string;
  eventType: string;
  outcome: ProviderPaymentOutcome;
  amount: number;
  currency: PaymentCurrency;
};

export type ProviderPaymentStatus = {
  providerPaymentId: string;
  outcome: ProviderPaymentOutcome;
  amount: number;
  currency: PaymentCurrency;
};

export type PaymentActionResult = ProviderPaymentStatus;

export interface PaymentProviderAdapter {
  createPayment(
    input: PaymentCreation,
  ): Promise<ProviderPaymentStatus & { redirectUrl?: string }>;
  verifyWebhookSignature(
    input: PaymentWebhookRequest,
    signature: string | null,
  ): Promise<boolean>;
  normalizeWebhook(input: PaymentWebhookRequest): VerifiedPaymentWebhook;
  getPaymentStatus(input: {
    providerPaymentId: string;
  }): Promise<ProviderPaymentStatus>;
  cancelPayment(input: { providerPaymentId: string }): Promise<PaymentActionResult>;
  refundPayment(input: { providerPaymentId: string }): Promise<PaymentActionResult>;
}
