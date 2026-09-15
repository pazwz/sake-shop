import { NotFoundError, ValidationError } from '@/lib/errors';
import { SmaregiProductExclusionRepository } from '@/repositories/smaregi-product-exclusion.repository';

export class SmaregiProductExclusionService {
  public constructor(
    private readonly repository = new SmaregiProductExclusionRepository(),
  ) {}

  public async excludeProduct(productId: string, adminUserId: string) {
    const result = await this.repository.applyForProduct(productId, adminUserId);
    if (!result) throw new NotFoundError('商品が見つかりません。');
    if ('unsupported' in result)
      throw new ValidationError('スマレジ連携商品だけをEC販売対象外にできます。');
    return result;
  }

  public listActive() {
    return this.repository.findActive();
  }

  public revoke(smaregiProductId: string) {
    return this.repository.revoke(smaregiProductId);
  }
}
