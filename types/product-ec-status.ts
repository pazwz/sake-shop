export const PRODUCT_EC_STATUS = {
  PUBLISHED: 'PUBLISHED',
  PREPARING: 'PREPARING',
  HIDDEN: 'HIDDEN',
  EC_EXCLUDED: 'EC_EXCLUDED',
  RETIRED: 'RETIRED',
} as const;

export type ProductEcStatus =
  (typeof PRODUCT_EC_STATUS)[keyof typeof PRODUCT_EC_STATUS];

export const PRODUCT_EC_STATUS_LABEL: Record<ProductEcStatus, string> = {
  PUBLISHED: 'EC販売中',
  PREPARING: '公開準備中',
  HIDDEN: '非公開',
  EC_EXCLUDED: 'EC販売対象外',
  RETIRED: '販売終了',
};

export type ProductEcStatusInput = {
  isActive: boolean;
  isEcAvailable: boolean;
  isManuallyHidden: boolean;
  isEcExcluded: boolean;
};
