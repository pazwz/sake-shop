import type { Prisma } from '@prisma/client';
import {
  getSmaregiProductionApiEnvironment,
  SMAREGI_KNOWN_ORPHAN_PRODUCT_IDS,
  SMAREGI_PRODUCTION_SYNC_ACTION,
  SMAREGI_PRODUCTION_SYNC_ENTITY_ID,
  SMAREGI_PRODUCTION_SYNC_ENTITY_TYPE,
} from '@/config/smaregi';
import { AppError } from '@/lib/errors';
import { SmaregiDryRunRepository } from '@/repositories/smaregi-dry-run.repository';
import { SmaregiProductionSyncLockRepository } from '@/repositories/smaregi-production-sync-lock.repository';
import { SyncRepository } from '@/repositories/sync.repository';
import { SmaregiAtomicSyncService } from '@/services/smaregi/smaregi-atomic-sync.service';
import { SmaregiClient } from '@/services/smaregi/smaregi-client';
import { SmaregiDryRunService } from '@/services/smaregi/smaregi-dry-run.service';
import { SmaregiProductionValidationService } from '@/services/smaregi/smaregi-production-validation.service';
import { buildValidatedSmaregiSyncPlan } from '@/services/smaregi/smaregi-sync-plan.service';
import { getSmaregiTargetDate } from '@/services/smaregi/smaregi-tax-resolver';
import type { SmaregiApiClient } from '@/types/smaregi';
import type {
  SmaregiDryRunResult,
  SmaregiDryRunSnapshot,
} from '@/types/smaregi-dry-run';
import type {
  SmaregiProductionSyncSkipped,
  SmaregiProductionSyncSummary,
  SmaregiProductionSyncTrigger,
} from '@/types/smaregi-production-sync';
import type { ValidatedSmaregiSyncPlan } from '@/types/smaregi-sync-plan';

type Lock = Pick<SmaregiProductionSyncLockRepository, 'withLock'>;
type Logs = {
  start(
    ...parameters: Parameters<SyncRepository['start']>
  ): Promise<{ id: string }>;
  succeed(
    ...parameters: Parameters<SyncRepository['succeed']>
  ): Promise<unknown>;
  fail(...parameters: Parameters<SyncRepository['fail']>): Promise<unknown>;
};
type SnapshotRepository = { getSnapshot(): Promise<SmaregiDryRunSnapshot> };
type AtomicSync = Pick<SmaregiAtomicSyncService, 'executeApprovedSync'>;
type PreparedSync = {
  plan: ValidatedSmaregiSyncPlan;
  comparison: SmaregiDryRunResult;
  sourceProductCount: number;
  sourceStockCount: number;
};

const knownOrphanIds = new Set<string>(SMAREGI_KNOWN_ORPHAN_PRODUCT_IDS);

export class ProductionSmaregiSyncService {
  public constructor(
    private readonly client: SmaregiApiClient = new SmaregiClient(
      fetch,
      undefined,
      getSmaregiProductionApiEnvironment(),
    ),
    private readonly atomic: AtomicSync = new SmaregiAtomicSyncService(),
    private readonly lock: Lock = new SmaregiProductionSyncLockRepository(),
    private readonly logs: Logs = new SyncRepository(),
    private readonly snapshots: SnapshotRepository = new SmaregiDryRunRepository(),
    private readonly validation = new SmaregiProductionValidationService(),
  ) {}

  public async run(
    trigger: SmaregiProductionSyncTrigger,
  ): Promise<SmaregiProductionSyncSummary | SmaregiProductionSyncSkipped> {
    const startedAt = new Date();
    const result = await this.lock.withLock(() =>
      this.runLocked(trigger, startedAt),
    );
    if (result.acquired) return result.value;

    const finishedAt = new Date();
    const skipped: SmaregiProductionSyncSkipped = {
      trigger,
      outcome: 'SKIPPED_ALREADY_RUNNING',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      sourceProductCount: 0,
      sourceStockCount: 0,
      productsCreated: 0,
      productsUpdated: 0,
      productsUnchanged: 0,
      productsDeferred: 0,
      productsQuarantined: 0,
      inventoryCreated: 0,
      inventoryUpdated: 0,
      inventoryZeroed: 0,
      inventoryUnchanged: 0,
      orphanCount: 0,
      knownOrphanCount: 0,
      newOrphanCount: 0,
      negativeCount: 0,
      warningsCount: 0,
      errorCode: 'SYNC_ALREADY_RUNNING',
      errorSummary: 'Another production Smaregi sync is already running.',
    };
    const log = await this.logs.start(
      SMAREGI_PRODUCTION_SYNC_ENTITY_TYPE,
      SMAREGI_PRODUCTION_SYNC_ENTITY_ID,
      SMAREGI_PRODUCTION_SYNC_ACTION,
      undefined,
      { trigger },
    );
    await this.logs.succeed(log.id, skipped as Prisma.InputJsonValue);
    return skipped;
  }

  private async runLocked(
    trigger: SmaregiProductionSyncTrigger,
    startedAt: Date,
  ): Promise<SmaregiProductionSyncSummary> {
    const log = await this.logs.start(
      SMAREGI_PRODUCTION_SYNC_ENTITY_TYPE,
      SMAREGI_PRODUCTION_SYNC_ENTITY_ID,
      SMAREGI_PRODUCTION_SYNC_ACTION,
      undefined,
      { trigger },
    );
    let prepared: PreparedSync | undefined;
    try {
      prepared = await this.prepare();
      await this.atomic.executeApprovedSync(prepared.plan);
      const summary = this.summary(trigger, startedAt, new Date(), prepared);
      await this.logs.succeed(
        log.id,
        summary as unknown as Prisma.InputJsonValue,
        this.client.retryCount,
      );
      return summary;
    } catch (error) {
      const failure = this.safeFailure(error);
      const finishedAt = new Date();
      await this.logs.fail(
        log.id,
        failure.errorSummary,
        this.client.retryCount,
        {
          trigger,
          outcome: 'FAILED',
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          ...this.failureCounts(prepared),
          ...failure,
        },
      );
      throw error;
    }
  }

  private async prepare() {
    const targetDate = getSmaregiTargetDate();
    const [stores, categories, products, standardTaxRates, reduceTaxRates] =
      await Promise.all([
        this.client.getStores(),
        this.client.getCategories(),
        this.client.getProducts(),
        this.client.getConsumptionTaxRates(),
        this.client.getReduceTaxRates(),
      ]);
    this.validation.validateSource({
      targetDate,
      stores,
      categories,
      products,
      stock: [],
      standardTaxRates,
    });
    const stockByStore = await Promise.all(
      stores.map(async (store) => ({
        storeId: store.storeId,
        stock: await this.client.getStock(store.storeId),
      })),
    );
    const stock = stockByStore.flatMap((item) => item.stock);
    this.validation.validateSource({
      targetDate,
      stores,
      categories,
      products,
      stock,
      standardTaxRates,
    });
    const snapshot = await this.snapshots.getSnapshot();
    this.validation.validateSnapshot(snapshot, products);
    const plan = buildValidatedSmaregiSyncPlan({
      targetDate,
      syncedAt: new Date(),
      stores,
      categories,
      products,
      stock,
      standardTaxRates,
      reduceTaxRates,
    });
    this.validation.validatePlan(plan);
    const safeIds = new Set(
      plan.products.map((item) => item.product.productId),
    );
    const comparisonClient: SmaregiApiClient = {
      retryCount: this.client.retryCount,
      getStores: async () => stores,
      getCategories: async () => categories,
      getProducts: async () => plan.products.map((item) => item.product),
      getConsumptionTaxRates: async () => standardTaxRates,
      getReduceTaxRates: async () => reduceTaxRates,
      getStock: async (storeId) =>
        (
          stockByStore.find((item) => item.storeId === storeId)?.stock ?? []
        ).filter((item) => safeIds.has(item.productId)),
    };
    const comparison = await new SmaregiDryRunService(
      comparisonClient,
      { getSnapshot: async () => snapshot },
      targetDate,
    ).dryRun();
    return {
      plan,
      comparison,
      sourceProductCount: products.length,
      sourceStockCount: stock.length,
    };
  }

  private summary(
    trigger: SmaregiProductionSyncTrigger,
    startedAt: Date,
    finishedAt: Date,
    prepared: PreparedSync,
  ): SmaregiProductionSyncSummary {
    const counts = this.syncCounts(prepared);
    return {
      trigger,
      outcome: counts.warningsCount > 0 ? 'SUCCESS_WITH_WARNINGS' : 'SUCCESS',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      ...counts,
      errorCode: null,
      errorSummary: null,
      quarantinedProducts: prepared.plan.quarantinedProducts,
    };
  }

  private safeFailure(error: unknown) {
    if (error instanceof AppError) {
      return { errorCode: error.code, errorSummary: error.message };
    }
    return {
      errorCode: 'SMAREGI_PRODUCTION_SYNC_FAILED',
      errorSummary: 'Production Smaregi synchronization failed.',
    };
  }

  private failureCounts(prepared: PreparedSync | undefined) {
    if (!prepared) {
      return {
        sourceProductCount: 0,
        sourceStockCount: 0,
        productsCreated: 0,
        productsUpdated: 0,
        productsUnchanged: 0,
        productsDeferred: 0,
        productsQuarantined: 0,
        inventoryCreated: 0,
        inventoryUpdated: 0,
        inventoryZeroed: 0,
        inventoryUnchanged: 0,
        orphanCount: 0,
        knownOrphanCount: 0,
        newOrphanCount: 0,
        negativeCount: 0,
        warningsCount: 0,
      };
    }
    const counts = this.syncCounts(prepared);
    return {
      ...counts,
      productsCreated: 0,
      productsUpdated: 0,
      inventoryCreated: 0,
      inventoryUpdated: 0,
      inventoryZeroed: 0,
    };
  }

  private syncCounts(prepared: PreparedSync) {
    const { plan, comparison } = prepared;
    const newOrphanCount = plan.warnings.orphanStock.filter(
      (item) => !knownOrphanIds.has(item.smaregiProductId),
    ).length;
    return {
      sourceProductCount: prepared.sourceProductCount,
      sourceStockCount: prepared.sourceStockCount,
      productsCreated: comparison.products.toCreate.length,
      productsUpdated:
        comparison.products.toUpdate.length +
        comparison.products.toDeactivate.length,
      productsUnchanged: comparison.products.unchanged.length,
      productsDeferred: plan.approvedDeferredProducts.length,
      productsQuarantined: plan.quarantinedProducts.length,
      inventoryCreated: comparison.inventory.toCreate.length,
      inventoryUpdated: comparison.inventory.toUpdate.length,
      inventoryZeroed: comparison.inventory.toZero.length,
      inventoryUnchanged: comparison.inventory.unchanged.length,
      orphanCount: plan.warnings.orphanStock.length,
      knownOrphanCount: plan.warnings.orphanStock.length - newOrphanCount,
      newOrphanCount,
      negativeCount: plan.warnings.negativeStock.length,
      warningsCount:
        plan.approvedDeferredProducts.length +
        plan.quarantinedProducts.length +
        plan.warnings.orphanStock.length +
        plan.warnings.negativeStock.length,
    };
  }
}
