import { SMAREGI_BOX_PRODUCT_IDS } from '@/config/smaregi';

export const SMAREGI_BOX_CATEGORY_ID = '8000014';

export const SMAREGI_PACKAGE_ONLY_PRODUCT_IDS = [
  ...SMAREGI_BOX_PRODUCT_IDS,
  '8000774',
] as const;

export const EXPECTED_BOX_PRODUCT_BY_BASE_PRODUCT_ID = {
  '8000001': { smaregiProductId: '8000570', name: '山崎12年 箱代金' },
  '8000002': { smaregiProductId: '8000571', name: '山崎NV 箱代金' },
  '8000008': { smaregiProductId: '8000572', name: '白州12年 箱代金' },
  '8000003': { smaregiProductId: '8000573', name: '白州NV 箱代金' },
  '8000014': { smaregiProductId: '8000574', name: '響BC 箱代金' },
  '8000016': { smaregiProductId: '8000575', name: '響JH 箱代金' },
} as const;

/**
 * Explicit main-product → package-only SKU compatibility.
 *
 * Never infer these relationships from brand or product-name fragments: one
 * brand can have multiple bottle sizes, editions, and package shapes.
 */
export const BOX_PRODUCT_COMPATIBILITY = {
  '8000001': ['8000570'],
  '8000002': ['8000571'],
  '8000008': ['8000572'],
  '8000003': ['8000573'],
  '8000014': ['8000574'],
  '8000016': ['8000575'],
  // The generic package SKU is compatible only with the standard 750ml item.
  '8000052': ['8000774'],
} as const satisfies Record<string, readonly string[]>;

export const getCompatibleBoxSmaregiProductIds = (
  baseSmaregiProductId: string,
): readonly string[] =>
  BOX_PRODUCT_COMPATIBILITY[
    baseSmaregiProductId as keyof typeof BOX_PRODUCT_COMPATIBILITY
  ] ?? [];

/**
 * Returns only explicit, one-to-one bottle → original-box relationships.
 *
 * This config is shared by Admin validation and the Smaregi sync transaction;
 * it is never inferred from a product name, brand, or package wording.
 */
export const getOriginalBoxAssociationPairs = () =>
  Object.entries(EXPECTED_BOX_PRODUCT_BY_BASE_PRODUCT_ID).map(
    ([parentSmaregiProductId, box]) => ({
      parentSmaregiProductId,
      accessorySmaregiProductId: box.smaregiProductId,
    }),
  );

export const DEFERRED_BOX_REASON = 'CATEGORY_TAX_DIVISION_MISSING';
