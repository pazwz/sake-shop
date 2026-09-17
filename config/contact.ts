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
 * The recipient is intentionally independent from the provider's From and
 * default Reply-To settings. A public request can never choose this address.
 */
export const getContactRuntimeConfig = (
  environment: ContactEnvironment = process.env as ContactEnvironment,
) => {
  const parsed = recipientSchema.safeParse(
    environment.CONTACT_RECIPIENT_EMAIL,
  );
  return parsed.success
    ? { available: true as const, recipient: parsed.data }
    : { available: false as const, recipient: null };
};
