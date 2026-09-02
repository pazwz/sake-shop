import type { AdminProductWithRelations } from '@/repositories/admin-product.repository';
import { AdminProductRepository } from '@/repositories/admin-product.repository';
import { projectApprovedInventory } from '@/services/inventory-projection.service';
import type { ProductPublicationResult } from '@/types/admin-product';

type PublicationProduct = Pick<
  AdminProductWithRelations,
  | 'id'
  | 'smaregiProductId'
  | 'price'
  | 'slug'
  | 'isActive'
  | 'lastSyncedAt'
  | 'description'
  | 'images'
  | 'inventoryMirrors'
>;

type PublicationPersistence = Pick<AdminProductRepository, 'findSlugOwner'>;

const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ProductPublicationService {
  public constructor(
    private readonly repository: PublicationPersistence = new AdminProductRepository(),
  ) {}

  public async validateProduct(
    product: PublicationProduct,
    activeReservedQuantity: number,
    checkSlugOwner = true,
  ): Promise<ProductPublicationResult> {
    const errors: ProductPublicationResult['errors'] = [];
    const warnings: ProductPublicationResult['warnings'] = [];
    const slug = product.slug.trim();

    if (!product.isActive)
      errors.push({
        code: 'PRODUCT_INACTIVE',
        message: 'スマレジで有効な商品に設定してください。',
      });
    if (Number(product.price) <= 0)
      errors.push({
        code: 'PRICE_INVALID',
        message: '商品価格が0円以下のため公開できません。',
      });
    if (!slug)
      errors.push({
        code: 'SLUG_MISSING',
        message: 'URLスラッグを設定してください。',
      });
    else if (!validSlug.test(slug))
      errors.push({
        code: 'SLUG_INVALID',
        message: 'URLスラッグは半角英数字とハイフンで設定してください。',
      });
    else if (checkSlugOwner) {
      const owner = await this.repository.findSlugOwner(slug);
      if (owner && owner.id !== product.id)
        errors.push({
          code: 'SLUG_DUPLICATE',
          message: 'このURLスラッグは別の商品で使用されています。',
        });
    }
    if (product.images.length === 0)
      errors.push({
        code: 'IMAGE_REQUIRED',
        message: '商品画像を1枚以上登録してください。',
      });
    if (!product.smaregiProductId || product.lastSyncedAt === null)
      errors.push({
        code: 'SYNC_SOURCE_INVALID',
        message: '有効なスマレジ商品同期情報がありません。',
      });
    if (!product.description?.trim())
      warnings.push({
        code: 'DESCRIPTION_RECOMMENDED',
        message: '商品説明を登録すると商品ページがより分かりやすくなります。',
      });

    const projection = projectApprovedInventory(
      product.inventoryMirrors,
      activeReservedQuantity,
    );
    if (projection.availableQuantity === 0)
      warnings.push({
        code: 'OUT_OF_STOCK',
        message:
          '在庫がありません。公開できますが、商品ページでは「在庫なし」と表示されます。',
      });

    return { canPublish: errors.length === 0, errors, warnings };
  }
}
