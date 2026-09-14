import { z } from 'zod';

const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z.string().min(10).max(128);

export const customerRegisterValidator = z
  .object({
    name: z.string().trim().min(1).max(100),
    email,
    password,
    marketingOptIn: z.boolean().optional(),
  })
  .strict();

export const customerLoginValidator = z.object({ email, password }).strict();

export const forgotPasswordValidator = z.object({ email }).strict();
export const resetPasswordValidator = z
  .object({ token: z.string().min(32).max(500), password })
  .strict();
export const verifyEmailValidator = z
  .object({ token: z.string().min(32).max(500) })
  .strict();

export type CustomerRegisterInput = z.infer<typeof customerRegisterValidator>;
export type CustomerLoginInput = z.infer<typeof customerLoginValidator>;
