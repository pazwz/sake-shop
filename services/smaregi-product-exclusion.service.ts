import { NotFoundError, ValidationError } from '@/lib/errors';
import { SmaregiProductExclusionRepository } from '@/repositories/smaregi-product-exclusion.repository';
import { SmaregiProductImageCleanupService } from '@/services/smaregi/smaregi-product-image-cleanup.service';

export class SmaregiProductExclusionService {
  public constructor(
    private readonly repository = new SmaregiProductExclusionRepository(),
    private readonly imageCleanup = new SmaregiProductImageCleanupService(),
  ) {}

  public async excludeProduct(productId: string, adminUserId: string) {
    const result = await this.repository.applyForProduct(productId, adminUserId);
    if (!result) throw new NotFoundError('商品が見つかりません。');
    if ('unsupported' in result)
      throw new ValidationError('スマレジ連携商品だけをEC販売対象外にできます。');
    const cleanup = await this.imageCleanup.cleanup({
      deletedImages: result.deletedImages,
    });
    return { ...result, cleanup };
  }

  public listActive() {
    return this.repository.findActive();
  }

  public revoke(smaregiProductId: string) {
    return this.repository.revoke(smaregiProductId);
  }
}
