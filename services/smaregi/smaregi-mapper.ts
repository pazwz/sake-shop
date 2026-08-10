import { STANDARD_TAX_RATE_PERCENT } from '@/config/smaregi';
import { toExternalSlug } from '@/lib/slug';
import type { SmaregiCategory, SmaregiProduct } from '@/types/smaregi';

export const mapSmaregiCategory = (
  category: SmaregiCategory,
  parentId: string | null,
) => ({
  name: category.categoryName,
  displayOrder: Number(category.displaySequence) || 0,
  isActive: category.displayFlag === '1',
  parentId,
});

export const mapSmaregiProductCreate = (
  product: SmaregiProduct,
  categoryId: string,
) => ({
  smaregiProductId: product.productId,
  categoryId,
  productCode: product.productCode,
  name: product.productName,
  slug: toExternalSlug(
    'smaregi-product',
    product.productCode,
    product.productId,
  ),
  price: product.price,
  taxRate: STANDARD_TAX_RATE_PERCENT,
  isActive: isActiveSmaregiProduct(product),
  isEcAvailable: false,
  lastSyncedAt: new Date(),
});

export const mapSmaregiProductUpdate = (
  product: SmaregiProduct,
  categoryId: string,
) => ({
  categoryId,
  productCode: product.productCode,
  name: product.productName,
  price: product.price,
  isActive: isActiveSmaregiProduct(product),
  lastSyncedAt: new Date(),
});

export const calculateAvailableQuantity = (
  quantity: number,
  reservedQuantity: number,
) => Math.max(0, quantity - reservedQuantity);

const isActiveSmaregiProduct = (product: SmaregiProduct) =>
  product.displayFlag === '1' &&
  product.salesDivision === '0' &&
  product.division === '0';
