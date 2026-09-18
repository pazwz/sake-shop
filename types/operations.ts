export type OperationsHealthStatus =
  | 'HEALTHY'
  | 'WARNING'
  | 'CRITICAL'
  | 'UNKNOWN';

export type OperationsHealthItem = {
  status: OperationsHealthStatus;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  failureCount: number;
  stale: boolean;
  backlogCount: number;
  summary: string;
};

export type OperationsHealth = {
  generatedAt: string;
  smaregiSync: OperationsHealthItem;
  reservationExpiration: OperationsHealthItem;
  emailOutbox: OperationsHealthItem;
  paymentReview: OperationsHealthItem;
};
