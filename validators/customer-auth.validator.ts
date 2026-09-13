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
  })
  .strict();

export const customerLoginValidator = z.object({ email, password }).strict();

export type CustomerRegisterInput = z.infer<typeof customerRegisterValidator>;
export type CustomerLoginInput = z.infer<typeof customerLoginValidator>;
