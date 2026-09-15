import { NotFoundError, ValidationError } from '@/lib/errors';
import { SmaregiProductExclusionRepository } from '@/repositories/smaregi-product-exclusion.repository';
import { SyncLogItemRepository } from '@/repositories/sync-log-item.repository';
import { SyncRepository } from '@/repositories/sync.repository';
import { SmaregiProductImageCleanupService } from '@/services/smaregi/smaregi-product-image-cleanup.service';
import { SyncLogItemType } from '@prisma/client';

export class SmaregiProductExclusionService {
  public constructor(
    private readonly repository = new SmaregiProductExclusionRepository(),
    private readonly imageCleanup = new SmaregiProductImageCleanupService(),
    private readonly logs = new SyncRepository(),
    private readonly detailLogs = new SyncLogItemRepository(),
  ) {}

  public async excludeProduct(productId: string, adminUserId?: string) {
    const result = await this.repository.applyForProduct(productId, adminUserId);
    if (!result) throw new NotFoundError('商品が見つかりません。');
    if ('unsupported' in result)
      throw new ValidationError('スマレジ連携商品だけをEC販売対象外にできます。');
    const cleanup = await this.imageCleanup.cleanup({
      deletedImages: result.deletedImages,
    });
    const auditLoggingFailed = !(await this.recordAudit(result, cleanup));
    return { ...result, cleanup, auditLoggingFailed };
  }

  public listActive() {
    return this.repository.findActive();
  }

  public revoke(smaregiProductId: string) {
    return this.repository.revoke(smaregiProductId);
  }

  private async recordAudit(
    result: Awaited<ReturnType<SmaregiProductExclusionRepository['applyForProduct']>>,
    cleanup: Awaited<ReturnType<SmaregiProductImageCleanupService['cleanup']>>,
  ) {
    if (!result || 'unsupported' in result) return false;
    try {
      const log = await this.logs.start(
        'EC_PRODUCT_EXCLUSION',
        result.exclusion.smaregiProductId,
        'OFFLINE_ONLY',
        undefined,
        { reason: result.exclusion.reason },
      );
      let detailLoggingFailed = false;
      try {
        await this.detailLogs.createMany(log.id, [
          {
            type: SyncLogItemType.PRODUCT_SUPPRESSED,
            smaregiProductId: result.exclusion.smaregiProductId,
            productCode: result.product?.productCode ?? null,
            productName: result.product?.name ?? null,
            reason: result.exclusion.reason,
            changes: {
              localOutcome: result.localOutcome,
              imageCleanup: {
                successCount: cleanup.successCount,
                failureCount: cleanup.failureCount,
                retainedSharedCount: cleanup.retainedSharedCount,
              },
            },
          },
        ]);
      } catch {
        detailLoggingFailed = true;
      }
      await this.logs.succeed(log.id, {
        localOutcome: result.localOutcome,
        detailLoggingFailed,
      });
      return !detailLoggingFailed;
    } catch {
      return false;
    }
  }
}
