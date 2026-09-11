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

export const DEFERRED_BOX_REASON = 'CATEGORY_TAX_DIVISION_MISSING';
