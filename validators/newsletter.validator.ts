import { z } from 'zod';

const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const newsletterSubscribeValidator = z
  .object({ email, consent: z.literal(true) })
  .strict();
export const newsletterUnsubscribeValidator = z
  .object({ token: z.string().min(32).max(500) })
  .strict();
