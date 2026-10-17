import { z } from 'zod';

export const emailModeSchema = z.enum(['console', 'resend', 'disabled']);
export type EmailMode = z.infer<typeof emailModeSchema>;

export const EMAIL_PROCESS_BATCH_SIZE = 20;
export const EMAIL_MAX_ATTEMPTS = 4;
export const EMAIL_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
export const EMAIL_RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000] as const;
// Historical resource retained DISABLED; new delivery has no recurring recovery cadence.
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
  VERCEL_URL?: string;
  VERCEL_OIDC_TOKEN?: string;
  PREVIEW_EMAIL_DISPATCH_EXPIRES_AT?: string;
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
  const secret = environment.CRON_SECRET;
  if (environment.VERCEL_ENV === 'preview') {
    let endpoint = '';
    const protectionToken = environment.VERCEL_OIDC_TOKEN;
    try {
      if (!environment.VERCEL_URL)
        throw new Error('PREVIEW_DEPLOYMENT_MISSING');
      if (!protectionToken) throw new Error('PREVIEW_PROTECTION_TOKEN_MISSING');
      const deployment = new URL(`https://${environment.VERCEL_URL}`);
      const target = new URL(
        environment.EMAIL_PROCESS_ENDPOINT_URL ??
          '/api/v1/internal/email/process',
        deployment,
      );
      endpoint = target.href;
      if (
        deployment.hostname !== environment.VERCEL_URL ||
        !deployment.hostname.endsWith('.vercel.app') ||
        target.origin !== deployment.origin ||
        target.pathname !== '/api/v1/internal/email/process' ||
        target.search ||
        target.hash ||
        target.username ||
        target.password
      )
        throw new Error('PREVIEW_ENDPOINT_INVALID');
      const claims = JSON.parse(
        Buffer.from(
          protectionToken?.split('.')[1] ?? '',
          'base64url',
        ).toString(),
      );
      if (typeof claims.sub !== 'string' || !claims.sub.endsWith(':environment:preview'))
        throw new Error('PREVIEW_PROTECTION_IDENTITY_INVALID');
      if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now())
        throw new Error('PREVIEW_PROTECTION_TOKEN_EXPIRED');
      if (
        !(
          new Date(
            environment.PREVIEW_EMAIL_DISPATCH_EXPIRES_AT ?? '',
          ).getTime() > Date.now()
        )
      )
        throw new Error('PREVIEW_PROTECTION_UNAVAILABLE');
      return {
        available: Boolean(secret && protectionToken),
        endpoint,
        secret: secret ?? null,
        protectionToken: protectionToken ?? null,
      };
    } catch (error) {
      const safeReasons = ['PREVIEW_DEPLOYMENT_MISSING', 'PREVIEW_PROTECTION_TOKEN_MISSING',
        'PREVIEW_ENDPOINT_INVALID', 'PREVIEW_PROTECTION_IDENTITY_INVALID',
        'PREVIEW_PROTECTION_TOKEN_EXPIRED', 'PREVIEW_PROTECTION_UNAVAILABLE'];
      return {
        available: false,
        endpoint,
        secret: null,
        protectionToken: null,
        reason: error instanceof Error && safeReasons.includes(error.message)
          ? error.message : 'PREVIEW_CONFIGURATION_INVALID',
      };
    }
  }
  const production = environment.VERCEL_ENV === 'production' ||
    (environment.NODE_ENV === 'production' && !environment.VERCEL_ENV);
  if (production) {
    const endpoint = environment.EMAIL_PROCESS_ENDPOINT_URL ?? '';
    return {
      available: Boolean(secret && endpoint === 'https://linxas-fukuoka.com/api/v1/internal/email/process'),
      endpoint,
      secret: secret ?? null,
      protectionToken: null,
    } as const;
  }
  const endpoint =
    environment.EMAIL_PROCESS_ENDPOINT_URL ??
    `${getPublicSiteUrl(environment).replace(/\/$/, '')}/api/v1/internal/email/process`;
  return {
    available: Boolean(secret && endpoint.startsWith('https://')),
    endpoint,
    secret: secret ?? null,
    protectionToken: null,
  } as const;
};
