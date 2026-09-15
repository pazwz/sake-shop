import type { Prisma } from '@prisma/client';
import {
  getSmaregiProductionApiEnvironment,
  getSmaregiMissingProductMode,
  SMAREGI_KNOWN_ORPHAN_PRODUCT_IDS,
  SMAREGI_PRODUCTION_SYNC_ACTION,
  SMAREGI_PRODUCTION_SYNC_ENTITY_ID,
  SMAREGI_PRODUCTION_SYNC_ENTITY_TYPE,
} from '@/config/smaregi';
import { AppError } from '@/lib/errors';
import { SmaregiDryRunRepository } from '@/repositories/smaregi-dry-run.repository';
import { SmaregiProductionSyncLockRepository } from '@/repositories/smaregi-production-sync-lock.repository';
import { SmaregiProductExclusionRepository } from '@/repositories/smaregi-product-exclusion.repository';
import { SyncRepository } from '@/repositories/sync.repository';
import { SyncLogItemRepository } from '@/repositories/sync-log-item.repository';
import { SmaregiAtomicSyncService } from '@/services/smaregi/smaregi-atomic-sync.service';
import { SmaregiClient } from '@/services/smaregi/smaregi-client';
import { SmaregiDryRunService } from '@/services/smaregi/smaregi-dry-run.service';
import { SmaregiProductionValidationService } from '@/services/smaregi/smaregi-production-validation.service';
import { SmaregiMissingProductService } from '@/services/smaregi/smaregi-missing-product.service';
import { SmaregiProductImageCleanupService } from '@/services/smaregi/smaregi-product-image-cleanup.service';
import { buildValidatedSmaregiSyncPlan } from '@/services/smaregi/smaregi-sync-plan.service';
import { SmaregiSyncLogItemService } from '@/services/smaregi/smaregi-sync-log-item.service';
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
import type {
  SmaregiAtomicSyncResult,
  SmaregiMissingProductPlan,
  SmaregiS3CleanupResult,
} from '@/types/smaregi-missing-product';
import type { SmaregiMissingProductMode } from '@/config/smaregi';

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
type MissingProducts = Pick<SmaregiMissingProductService, 'buildPlan'>;
type ImageCleanup = Pick<SmaregiProductImageCleanupService, 'cleanup'>;
type DetailLogs = Pick<SyncLogItemRepository, 'createMany'>;
type Exclusions = Pick<
  SmaregiProductExclusionRepository,
  'findActiveSmaregiProductIds'
>;
type PreparedSync = {
  plan: ValidatedSmaregiSyncPlan;
  comparison: SmaregiDryRunResult;
  sourceProductCount: number;
  sourceIdentityCount: number;
  snapshotComplete: true;
  sourceStockCount: number;
  missingPlan: SmaregiMissingProductPlan;
  storeNames: Map<string, string | null>;
};
type CompletedSync = PreparedSync & {
  writeResult: SmaregiAtomicSyncResult;
  cleanupResult: SmaregiS3CleanupResult;
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
    private readonly missingProducts: MissingProducts = new SmaregiMissingProductService(),
    private readonly imageCleanup: ImageCleanup = new SmaregiProductImageCleanupService(),
    private readonly exclusions: Exclusions = new SmaregiProductExclusionRepository(),
    private readonly detailLogs: DetailLogs = new SyncLogItemRepository(),
    private readonly detailBuilder = new SmaregiSyncLogItemService(),
    private readonly missingMode: () => SmaregiMissingProductMode = getSmaregiMissingProductMode,
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
      sourceIdentityCount: 0,
      snapshotComplete: false,
      sourceStockCount: 0,
      suppressedProductCount: 0,
      syncCandidateProductCount: 0,
      mode: this.missingMode(),
      missingProductMode: this.missingMode(),
      missingProductCount: 0,
      missingSafeDeleteCount: 0,
      missingRetireCount: 0,
      missingBlockedCount: 0,
      deletedProductCount: 0,
      retiredProductCount: 0,
      suppressedDeletedProductCount: 0,
      suppressedRetiredProductCount: 0,
      s3DeleteSuccessCount: 0,
      s3DeleteFailureCount: 0,
      s3RetainedSharedCount: 0,
      s3CleanupFailures: [],
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
      detailLoggingFailed: false,
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
      const rawWriteResult = await this.atomic.executeApprovedSync(
        prepared.plan,
        prepared.missingPlan,
      );
      const writeResult: SmaregiAtomicSyncResult = {
        ...rawWriteResult,
        reconciliation: rawWriteResult.reconciliation ?? {
          deletedProductCount: 0,
          retiredProductCount: 0,
          deletedImages: [],
          events: [],
        },
        suppression: rawWriteResult.suppression ?? {
          deletedProductCount: 0,
          retiredProductCount: 0,
          deletedImages: [],
          events: [],
        },
      };
      const cleanupResult = await this.imageCleanup.cleanup(
        {
          deletedProductCount:
            writeResult.reconciliation.deletedProductCount +
            writeResult.suppression.deletedProductCount,
          retiredProductCount:
            writeResult.reconciliation.retiredProductCount +
            writeResult.suppression.retiredProductCount,
          deletedImages: [
            ...writeResult.reconciliation.deletedImages,
            ...writeResult.suppression.deletedImages,
          ],
        },
      );
      const completed: CompletedSync = {
        ...prepared,
        writeResult,
        cleanupResult,
      };
      const summary = this.summary(trigger, startedAt, new Date(), completed);
      try {
        await this.detailLogs.createMany(
          log.id,
          this.detailBuilder.build({
            plan: completed.plan,
            comparison: completed.comparison,
            writeResult,
            storeNames: completed.storeNames,
          }),
        );
      } catch {
        summary.detailLoggingFailed = true;
      }
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
    const [
      stores,
      categories,
      productSnapshot,
      standardTaxRates,
      reduceTaxRates,
    ] = await Promise.all([
      this.client.getStores(),
      this.client.getCategories(),
      this.client.getProductsSnapshot(),
      this.client.getConsumptionTaxRates(),
      this.client.getReduceTaxRates(),
    ]);
    const products = productSnapshot.products;
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
    const suppressedSmaregiProductIds =
      await this.exclusions.findActiveSmaregiProductIds();
    const plan = buildValidatedSmaregiSyncPlan({
      targetDate,
      syncedAt: new Date(),
      stores,
      categories,
      products,
      stock,
      standardTaxRates,
      reduceTaxRates,
      suppressedSmaregiProductIds,
    });
    this.validation.validatePlan(plan);
    const missingPlan = await this.missingProducts.buildPlan(
      productSnapshot,
      this.missingMode(),
    );
    const safeIds = new Set(
      plan.products.map((item) => item.product.productId),
    );
    const comparisonClient: SmaregiApiClient = {
      retryCount: this.client.retryCount,
      getStores: async () => stores,
      getCategories: async () => categories,
      getProducts: async () => plan.products.map((item) => item.product),
      getProductsSnapshot: async () => ({
        products: plan.products.map((item) => item.product),
        sourceIdentityCount: plan.products.length,
        pagesFetched: productSnapshot.pagesFetched,
        pageSize: productSnapshot.pageSize,
        complete: true,
      }),
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
      sourceIdentityCount: productSnapshot.sourceIdentityCount,
      snapshotComplete: productSnapshot.complete,
      sourceStockCount: stock.length,
      missingPlan,
      storeNames: new Map(
        stores.map((store) => [store.storeId, store.storeName ?? null]),
      ),
    };
  }

  private summary(
    trigger: SmaregiProductionSyncTrigger,
    startedAt: Date,
    finishedAt: Date,
    prepared: CompletedSync,
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
        sourceIdentityCount: 0,
        snapshotComplete: false,
        sourceStockCount: 0,
        suppressedProductCount: 0,
        syncCandidateProductCount: 0,
        mode: this.missingMode(),
        missingProductMode: this.missingMode(),
        missingProductCount: 0,
        missingSafeDeleteCount: 0,
        missingRetireCount: 0,
        missingBlockedCount: 0,
        deletedProductCount: 0,
        retiredProductCount: 0,
        suppressedDeletedProductCount: 0,
        suppressedRetiredProductCount: 0,
        s3DeleteSuccessCount: 0,
        s3DeleteFailureCount: 0,
        s3RetainedSharedCount: 0,
        s3CleanupFailures: [],
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
        detailLoggingFailed: false,
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
    const completed =
      'writeResult' in prepared ? (prepared as CompletedSync) : null;
    const newOrphanCount = plan.warnings.orphanStock.filter(
      (item) => !knownOrphanIds.has(item.smaregiProductId),
    ).length;
    return {
      sourceProductCount: prepared.sourceProductCount,
      sourceIdentityCount: prepared.sourceIdentityCount,
      snapshotComplete: prepared.snapshotComplete,
      sourceStockCount: prepared.sourceStockCount,
      suppressedProductCount: plan.suppressedProducts.length,
      syncCandidateProductCount: plan.products.length,
      mode: prepared.missingPlan.mode,
      missingProductMode: prepared.missingPlan.mode,
      missingProductCount:
        prepared.missingPlan.safeToDelete.length +
        prepared.missingPlan.retire.length +
        prepared.missingPlan.blocked.length,
      missingSafeDeleteCount: prepared.missingPlan.safeToDelete.length,
      missingRetireCount: prepared.missingPlan.retire.length,
      missingBlockedCount: prepared.missingPlan.blocked.length,
      deletedProductCount:
        completed?.writeResult.reconciliation.deletedProductCount ?? 0,
      retiredProductCount:
        completed?.writeResult.reconciliation.retiredProductCount ?? 0,
      suppressedDeletedProductCount:
        completed?.writeResult.suppression.deletedProductCount ?? 0,
      suppressedRetiredProductCount:
        completed?.writeResult.suppression.retiredProductCount ?? 0,
      s3DeleteSuccessCount: completed?.cleanupResult.successCount ?? 0,
      s3DeleteFailureCount: completed?.cleanupResult.failureCount ?? 0,
      s3RetainedSharedCount: completed?.cleanupResult.retainedSharedCount ?? 0,
      s3CleanupFailures: completed?.cleanupResult.failures ?? [],
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
        plan.warnings.negativeStock.length +
        prepared.missingPlan.blocked.length +
        (completed?.cleanupResult.failureCount ?? 0),
      detailLoggingFailed: false,
    };
  }
}
