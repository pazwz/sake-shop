import {
  getSmaregiProductionConfigurationStatus,
  SMAREGI_PRODUCTION_SYNC_ENTITY_TYPE,
} from '@/config/smaregi';
import { SyncRepository } from '@/repositories/sync.repository';
import type {
  SmaregiProductionSyncOutcome,
  SmaregiProductionSyncStatus,
} from '@/types/smaregi-production-sync';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const numberField = (value: Record<string, unknown>, key: string) =>
  typeof value[key] === 'number' ? value[key] : 0;

const productionOutcomes = new Set<SmaregiProductionSyncOutcome>([
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'SKIPPED_ALREADY_RUNNING',
]);

export class SyncService {
  public constructor(private readonly repository = new SyncRepository()) {}

  public async getSmaregiStatus() {
    const [lastProductSync, lastInventorySync, recentLogs] = await Promise.all([
      this.repository.findLast('PRODUCT'),
      this.repository.findLast('INVENTORY'),
      this.repository.findRecent(),
    ]);
    return {
      ...getSmaregiProductionConfigurationStatus(),
      lastProductSync,
      lastInventorySync,
      recentLogs,
    };
  }

  public async getProductionSmaregiSyncStatus(): Promise<SmaregiProductionSyncStatus> {
    const log = await this.repository.findLast(
      SMAREGI_PRODUCTION_SYNC_ENTITY_TYPE,
    );
    if (!log) {
      return {
        status: null,
        outcome: null,
        completedAt: null,
        errorMessage: null,
        summary: null,
      };
    }
    const payload = isRecord(log.responsePayload) ? log.responsePayload : null;
    const rawOutcome = payload?.outcome;
    const outcome =
      typeof rawOutcome === 'string' &&
      productionOutcomes.has(rawOutcome as SmaregiProductionSyncOutcome)
        ? (rawOutcome as SmaregiProductionSyncOutcome)
        : log.status === 'FAILED'
          ? 'FAILED'
          : null;
    const summary: SmaregiProductionSyncStatus['summary'] = payload
      ? {
          productsCreated: numberField(payload, 'productsCreated'),
          productsUpdated: numberField(payload, 'productsUpdated'),
          inventoryCreated: numberField(payload, 'inventoryCreated'),
          inventoryUpdated: numberField(payload, 'inventoryUpdated'),
          inventoryZeroed: numberField(payload, 'inventoryZeroed'),
          warningsCount: numberField(payload, 'warningsCount'),
          productsQuarantined: numberField(payload, 'productsQuarantined'),
          productsDeferred: numberField(payload, 'productsDeferred'),
          knownOrphanCount: numberField(payload, 'knownOrphanCount'),
          newOrphanCount: numberField(payload, 'newOrphanCount'),
          negativeCount: numberField(payload, 'negativeCount'),
        }
      : null;
    return {
      status: log.status,
      outcome,
      completedAt: (log.completedAt ?? log.createdAt).toISOString(),
      errorMessage: log.errorMessage,
      summary,
    };
  }
}
