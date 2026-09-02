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
  taxRate: string,
  lastSyncedAt = new Date(),
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
  taxRate,
  isActive: isActiveSmaregiProduct(product),
  isEcAvailable: false,
  lastSyncedAt,
});

export const mapSmaregiProductUpdate = (
  product: SmaregiProduct,
  categoryId: string,
  lastSyncedAt = new Date(),
) => ({
  categoryId,
  productCode: product.productCode,
  name: product.productName,
  price: product.price,
  isActive: isActiveSmaregiProduct(product),
  lastSyncedAt,
});

export const calculateAvailableQuantity = (
  quantity: number,
  reservedQuantity: number,
) => Math.max(0, quantity - reservedQuantity);

const isActiveSmaregiProduct = (product: SmaregiProduct) =>
  product.displayFlag === '1' &&
  product.salesDivision === '0' &&
  product.division === '0';
