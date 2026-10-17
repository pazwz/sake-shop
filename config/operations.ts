export const OPERATIONS_SYSTEM = 'OPERATIONS';
export const RESERVATION_EXPIRATION_OPERATION = 'RESERVATION_EXPIRATION';
export const EMAIL_OUTBOX_OPERATION = 'EMAIL_OUTBOX';

export const OPERATIONS_HEALTH_THRESHOLDS = {
  smaregiSync: { warningMs: 30 * 60 * 60_000, criticalMs: 48 * 60 * 60_000 },
  reservationWorker: { warningMs: 26 * 60 * 60_000, criticalMs: 50 * 60 * 60_000 },
  emailWorker: { warningMs: 15 * 60_000, criticalMs: 30 * 60_000 },
  reservationExpiredBacklog: { warning: 1, critical: 10 },
  emailPendingBacklog: { warning: 10, critical: 50 },
} as const;
