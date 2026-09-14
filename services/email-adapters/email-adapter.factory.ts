import { getEmailRuntimeConfig } from '@/config/email';
import { ConsoleEmailAdapter } from '@/services/email-adapters/console-email.adapter';
import { ResendEmailAdapter } from '@/services/email-adapters/resend-email.adapter';
import type { EmailProviderAdapter } from '@/types/email';

export const getEmailAdapter = (): EmailProviderAdapter | null => {
  const config = getEmailRuntimeConfig();
  if (!config.available) return null;
  return config.mode === 'resend'
    ? new ResendEmailAdapter()
    : new ConsoleEmailAdapter();
};
