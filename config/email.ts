import { z } from 'zod';

export const emailModeSchema = z.enum(['console', 'resend', 'disabled']);
export type EmailMode = z.infer<typeof emailModeSchema>;

export const EMAIL_PROCESS_BATCH_SIZE = 20;
export const EMAIL_MAX_ATTEMPTS = 5;
export const EMAIL_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
export const EMAIL_RETRY_DELAYS_MS = [
  60_000, 300_000, 1_800_000, 7_200_000,
] as const;
export const EMAIL_RECOVERY_SCHEDULER_RATE_MINUTES = 10;
export const EMAIL_DISPATCH_TRIGGER_TIMEOUT_MS = 10_000;
/**
 * Post-commit internal worker wake-up attempts. These are deliberately
 * separate from EmailOutbox provider retry delays: they retry only the
 * application-to-application trigger request.
 */
export const EMAIL_DISPATCH_TRIGGER_DELAYS_MS = [0, 1_000, 3_000] as const;
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export type EmailEnvironment = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  EMAIL_MODE?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_REPLY_TO_EMAIL?: string;
  RESEND_WEBHOOK_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  CRON_SECRET?: string;
  EMAIL_PROCESS_ENDPOINT_URL?: string;
};

export const getEmailRuntimeConfig = (
  environment: EmailEnvironment = process.env,
) => {
  const production =
    environment.VERCEL_ENV === 'production' ||
    (environment.NODE_ENV === 'production' && !environment.VERCEL_ENV);
  const parsed = emailModeSchema.safeParse(environment.EMAIL_MODE);
  const requestedMode = parsed.success ? parsed.data : null;
  const mode: EmailMode =
    requestedMode ?? (production ? 'disabled' : 'console');
  if (production && mode === 'console')
    return {
      mode: 'disabled' as const,
      available: false,
      reason: 'CONSOLE_FORBIDDEN',
    };
  if (mode === 'resend') {
    const available = Boolean(
      environment.RESEND_API_KEY && environment.RESEND_FROM_EMAIL,
    );
    return {
      mode,
      available,
      reason: available ? null : 'RESEND_CONFIGURATION_MISSING',
    } as const;
  }
  return {
    mode,
    available: mode === 'console',
    reason: mode === 'disabled' ? 'EMAIL_DISABLED' : null,
  } as const;
};

export const getPublicSiteUrl = (environment: EmailEnvironment = process.env) =>
  environment.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const getEmailDispatchTriggerConfig = (
  environment: EmailEnvironment = process.env,
) => {
  const endpoint =
    environment.EMAIL_PROCESS_ENDPOINT_URL ??
    `${getPublicSiteUrl(environment).replace(/\/$/, '')}/api/v1/internal/email/process`;
  const secret = environment.CRON_SECRET;
  return {
    available: Boolean(secret && endpoint.startsWith('https://')),
    endpoint,
    secret: secret ?? null,
  } as const;
};
