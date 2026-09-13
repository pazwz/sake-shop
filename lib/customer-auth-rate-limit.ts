import {
  CUSTOMER_AUTH_RATE_LIMIT_WINDOW_MS,
  CUSTOMER_LOGIN_MAX_ATTEMPTS,
  CUSTOMER_REGISTER_MAX_ATTEMPTS,
} from '@/config/customer-auth';

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();

const limitFor = (action: 'login' | 'register') =>
  action === 'login'
    ? CUSTOMER_LOGIN_MAX_ATTEMPTS
    : CUSTOMER_REGISTER_MAX_ATTEMPTS;

export const canAttemptCustomerAuth = (
  action: 'login' | 'register',
  key: string,
) => {
  const attempt = attempts.get(`${action}:${key}`);
  if (!attempt || attempt.resetAt <= Date.now()) return true;
  return attempt.count < limitFor(action);
};

export const recordCustomerAuthFailure = (
  action: 'login' | 'register',
  key: string,
) => {
  const mapKey = `${action}:${key}`;
  const now = Date.now();
  const attempt = attempts.get(mapKey);
  attempts.set(
    mapKey,
    !attempt || attempt.resetAt <= now
      ? { count: 1, resetAt: now + CUSTOMER_AUTH_RATE_LIMIT_WINDOW_MS }
      : { ...attempt, count: attempt.count + 1 },
  );
};

export const clearCustomerAuthFailures = (
  action: 'login' | 'register',
  key: string,
) => attempts.delete(`${action}:${key}`);
