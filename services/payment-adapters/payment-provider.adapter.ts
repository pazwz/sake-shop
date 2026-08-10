import { PaymentProvider, PaymentStatus } from '@prisma/client';

export type PaymentCreation = {
  provider: PaymentProvider;
  orderNumber: string;
  amount: number;
};

export type PaymentWebhook = {
  provider: PaymentProvider;
  providerPaymentId: string;
  eventId: string;
  status: PaymentStatus;
  amount?: number;
};

export interface PaymentProviderAdapter {
  createPayment(
    input: PaymentCreation,
  ): Promise<{ providerPaymentId: string; amount: number }>;
  verifyWebhookSignature(
    input: PaymentWebhook,
    signature: string | null,
  ): Promise<boolean>;
}
