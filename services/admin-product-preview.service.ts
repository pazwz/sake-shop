import { NotFoundError } from '@/lib/errors';
import {
  createAdminProductPreviewToken,
  readAdminProductPreviewToken,
} from '@/lib/admin-product-preview-token';
import { AdminProductRepository } from '@/repositories/admin-product.repository';
import { ProductService } from '@/services/product.service';
import { isStandaloneEcProduct } from '@/services/product-visibility.service';

export class AdminProductPreviewService {
  public constructor(
    private readonly adminProducts = new AdminProductRepository(),
    private readonly products = new ProductService(),
  ) {}

  public async createPreviewPath(productId: string, adminId: string) {
    const product = await this.adminProducts.findById(productId);
    if (!product || !isStandaloneEcProduct(product))
      throw new NotFoundError('商品が見つかりません。');
    const token = await createAdminProductPreviewToken({ productId, adminId });
    return `/products/${encodeURIComponent(product.slug)}?previewToken=${encodeURIComponent(token)}`;
  }

  public async getPreviewProduct(slug: string, token: string, adminId: string) {
    const claims = await readAdminProductPreviewToken(token);
    if (!claims || claims.adminId !== adminId)
      throw new NotFoundError('Product preview not found.');
    const product = await this.products.getPreviewProductBySlug(slug);
    if (product.id !== claims.productId)
      throw new NotFoundError('Product preview not found.');
    return product;
  }
}
