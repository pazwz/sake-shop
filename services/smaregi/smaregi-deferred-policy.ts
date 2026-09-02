import { SMAREGI_BOX_PRODUCT_IDS } from '@/config/smaregi';
import type { SmaregiTaxBlockCode } from '@/services/smaregi/smaregi-tax-resolver';

export const SMAREGI_APPROVED_DEFERRED_REASON =
  'CATEGORY_TAX_DIVISION_MISSING' as const;

const approvedDeferredProductIds = new Set<string>(SMAREGI_BOX_PRODUCT_IDS);

export const isApprovedDeferredSmaregiProduct = (
  productId: string,
  blockCode: SmaregiTaxBlockCode,
): blockCode is typeof SMAREGI_APPROVED_DEFERRED_REASON =>
  approvedDeferredProductIds.has(productId) &&
  blockCode === SMAREGI_APPROVED_DEFERRED_REASON;
