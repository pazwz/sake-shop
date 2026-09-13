export const CUSTOMER_SESSION_COOKIE = 'linxas_customer_session';
export const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const CUSTOMER_PASSWORD_HASH_ROUNDS = 12;
export const CUSTOMER_LOGIN_MAX_ATTEMPTS = 5;
export const CUSTOMER_REGISTER_MAX_ATTEMPTS = 5;
export const CUSTOMER_AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export const customerSessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: CUSTOMER_SESSION_TTL_SECONDS,
});
