export const SMAREGI_PRODUCTION_SYNC_TRIGGERS = ['CRON', 'ADMIN'] as const;
export type SmaregiProductionSyncTrigger =
  (typeof SMAREGI_PRODUCTION_SYNC_TRIGGERS)[number];

export const SMAREGI_PRODUCTION_SYNC_OUTCOMES = [
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'SKIPPED_ALREADY_RUNNING',
] as const;
export type SmaregiProductionSyncOutcome =
  (typeof SMAREGI_PRODUCTION_SYNC_OUTCOMES)[number];

export type SmaregiProductionSyncSummary = {
  trigger: SmaregiProductionSyncTrigger;
  outcome: SmaregiProductionSyncOutcome;
  startedAt: string;
  finishedAt: string;
  sourceProductCount: number;
  sourceStockCount: number;
  productsCreated: number;
  productsUpdated: number;
  productsUnchanged: number;
  productsDeferred: number;
  productsQuarantined: number;
  inventoryCreated: number;
  inventoryUpdated: number;
  inventoryZeroed: number;
  inventoryUnchanged: number;
  orphanCount: number;
  knownOrphanCount: number;
  newOrphanCount: number;
  negativeCount: number;
  warningsCount: number;
  errorCode: null;
  errorSummary: null;
  quarantinedProducts: Array<{
    smaregiProductId: string;
    productCode: string;
    reasonCode: string;
    message: string;
  }>;
};

export type SmaregiProductionSyncSkipped = {
  trigger: SmaregiProductionSyncTrigger;
  outcome: 'SKIPPED_ALREADY_RUNNING';
  startedAt: string;
  finishedAt: string;
  sourceProductCount: 0;
  sourceStockCount: 0;
  productsCreated: 0;
  productsUpdated: 0;
  productsUnchanged: 0;
  productsDeferred: 0;
  productsQuarantined: 0;
  inventoryCreated: 0;
  inventoryUpdated: 0;
  inventoryZeroed: 0;
  inventoryUnchanged: 0;
  orphanCount: 0;
  knownOrphanCount: 0;
  newOrphanCount: 0;
  negativeCount: 0;
  warningsCount: 0;
  errorCode: 'SYNC_ALREADY_RUNNING';
  errorSummary: 'Another production Smaregi sync is already running.';
};

export type SmaregiProductionSyncStatus = {
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING' | null;
  outcome: SmaregiProductionSyncOutcome | 'FAILED' | null;
  completedAt: string | null;
  errorMessage: string | null;
  summary: Pick<
    SmaregiProductionSyncSummary,
    | 'productsCreated'
    | 'productsUpdated'
    | 'inventoryCreated'
    | 'inventoryUpdated'
    | 'inventoryZeroed'
    | 'warningsCount'
    | 'productsQuarantined'
    | 'productsDeferred'
    | 'knownOrphanCount'
    | 'newOrphanCount'
    | 'negativeCount'
  > | null;
};
