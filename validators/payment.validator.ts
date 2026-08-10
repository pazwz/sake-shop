import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { z } from 'zod';

export const paymentCreateValidator = z
  .object({
    orderId: z.string().cuid().optional(),
    orderNumber: z.string().trim().min(1).max(64).optional(),
    provider: z.nativeEnum(PaymentProvider),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .refine((input) => input.orderId || input.orderNumber, {
    message: 'An order identifier is required.',
  });

export const paymentWebhookValidator = z.object({
  provider: z.nativeEnum(PaymentProvider),
  providerPaymentId: z.string().trim().min(1).max(255),
  eventId: z.string().trim().min(8).max(255),
  status: z.nativeEnum(PaymentStatus),
  amount: z.number().nonnegative().optional(),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateValidator>;
export type PaymentWebhookInput = z.infer<typeof paymentWebhookValidator>;
