import {
  PRODUCT_EC_STATUS,
  type ProductEcStatus,
  type ProductEcStatusInput,
} from '@/types/product-ec-status';

/** Resolves the single operator-facing EC status with stable priority. */
export const resolveProductEcStatus = (
  product: ProductEcStatusInput,
): ProductEcStatus => {
  if (product.isEcExcluded) return PRODUCT_EC_STATUS.EC_EXCLUDED;
  if (!product.isActive) return PRODUCT_EC_STATUS.RETIRED;
  if (product.isManuallyHidden) return PRODUCT_EC_STATUS.HIDDEN;
  if (!product.isEcAvailable) return PRODUCT_EC_STATUS.PREPARING;
  return PRODUCT_EC_STATUS.PUBLISHED;
};
