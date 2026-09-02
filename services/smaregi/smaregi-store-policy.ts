import { AppError } from '@/lib/errors';
import {
  SMAREGI_APPROVED_STORE_IDS,
  SMAREGI_BOX_PRODUCT_IDS,
} from '@/config/smaregi';
import type { SmaregiStore } from '@/types/smaregi';

const approvedStoreIds = new Set<string>(SMAREGI_APPROVED_STORE_IDS);
const boxProductIds = new Set<string>(SMAREGI_BOX_PRODUCT_IDS);

export const isApprovedSmaregiStore = (storeId: string) =>
  approvedStoreIds.has(storeId);

export const selectApprovedSmaregiStores = (
  stores: SmaregiStore[],
  requireAtLeastOne = true,
) => {
  const byId = new Map(stores.map((store) => [store.storeId, store]));
  const selected = SMAREGI_APPROVED_STORE_IDS.flatMap((storeId) => {
    const store = byId.get(storeId);
    return store ? [store] : [];
  });
  if (requireAtLeastOne && selected.length === 0)
    throw new AppError(
      'No approved Smaregi store is available.',
      'SMAREGI_APPROVED_STORE_NOT_FOUND',
      422,
    );
  return selected;
};

export const getMissingApprovedSmaregiStoreIds = (stores: SmaregiStore[]) => {
  const received = new Set(stores.map((store) => store.storeId));
  return SMAREGI_APPROVED_STORE_IDS.filter((storeId) => !received.has(storeId));
};

export const getSmaregiSpecialProductKind = (productId: string) =>
  boxProductIds.has(productId) ? ('BOX' as const) : null;
