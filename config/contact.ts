import { z } from 'zod';

const recipientSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

export type ContactEnvironment = {
  CONTACT_RECIPIENT_EMAIL?: string;
};

/**
 * Optional internal notification recipient for new in-site order messages.
 * Customer correspondence always remains in the authenticated My Page thread.
 */
export const getContactRuntimeConfig = (
  environment: ContactEnvironment = process.env as ContactEnvironment,
) => {
  const parsed = recipientSchema.safeParse(environment.CONTACT_RECIPIENT_EMAIL);
  return parsed.success
    ? { available: true as const, recipient: parsed.data }
    : { available: false as const, recipient: null };
};
