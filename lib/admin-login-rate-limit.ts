const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

export const canAttemptAdminLogin = (key: string) => {
  const now = Date.now();
  const attempt = attempts.get(key);
  if (!attempt || attempt.resetAt <= now) return true;
  return attempt.count < MAX_ATTEMPTS;
};

export const recordFailedAdminLogin = (key: string) => {
  const now = Date.now();
  const attempt = attempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  attempts.set(key, { ...attempt, count: attempt.count + 1 });
};

export const clearAdminLoginAttempts = (key: string) => attempts.delete(key);
