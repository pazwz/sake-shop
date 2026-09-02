import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const orderValidator = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1)
    .superRefine((items, context) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (seen.has(item.productId))
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Each product may appear only once.',
            path: [index, 'productId'],
          });
        seen.add(item.productId);
      });
    }),
  customer: z.object({
    email: z.string().email(),
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(8).max(30),
  }),
  address: z.object({
    postalCode: z.string().trim().min(3).max(12),
    prefecture: z.string().trim().min(1),
    city: z.string().trim().min(1),
    addressLine1: z.string().trim().min(1),
    addressLine2: z.string().trim().max(200).optional(),
    recipientName: z.string().trim().min(1),
    phone: z.string().trim().min(8).max(30),
  }),
  ageConfirmed: z.literal(true),
  shippingMethod: z.string().trim().min(1).max(100),
  paymentMethod: z.enum(['card', 'paypay']),
});
export const adminOrderQueryValidator = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  keyword: z.string().trim().optional(),
});
export const adminOrderUpdateValidator = z.object({
  status: z.nativeEnum(OrderStatus),
});
export type OrderInput = z.infer<typeof orderValidator>;
