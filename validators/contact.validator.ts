import { z } from 'zod';
import { CONTACT_TOPICS } from '@/types/contact';

const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

const orderNumber = z
  .string()
  .trim()
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid order number.')
  .optional()
  .transform((value) => value || undefined);

export const contactSubmitValidator = z
  .object({
    submissionId: z.string().uuid(),
    topic: z.enum([
      'PRODUCT',
      'SHIPPING',
      'PRE_ORDER',
      'ORDER_CHANGE_CANCEL',
      'OTHER',
    ]),
    email,
    message: z.string().trim().min(1).max(5000),
    orderNumber,
    website: z.string().trim().max(200).optional().default(''),
  })
  .strict();

export type ContactSubmitInput = z.infer<typeof contactSubmitValidator>;

export const isContactTopic = (value: string): value is keyof typeof CONTACT_TOPICS =>
  value in CONTACT_TOPICS;
