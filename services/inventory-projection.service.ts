import { AppError } from '@/lib/errors';
import {
  SMAREGI_APPROVED_STORE_IDS,
  SMAREGI_PRIMARY_STORE_ID,
} from '@/config/smaregi';

type InventoryProjectionInput = {
  smaregiStoreId: string;
  quantity: number;
};

export type ApprovedInventoryProjection = {
  physicalTotalApproved: number;
  store1Physical: number;
  store1UsableForNewOrder: number;
  activeReservedQuantity: number;
  availableQuantity: number;
};

const approvedStoreIds = new Set<string>(SMAREGI_APPROVED_STORE_IDS);

export const projectApprovedInventory = (
  inventory: InventoryProjectionInput[],
  activeReservedQuantity: number,
): ApprovedInventoryProjection => {
  if (
    !Number.isSafeInteger(activeReservedQuantity) ||
    activeReservedQuantity < 0
  )
    throw new AppError(
      'Active reserved quantity must be a non-negative integer.',
      'INVALID_RESERVED_QUANTITY',
      500,
    );
  const approved = inventory.filter((item) =>
    approvedStoreIds.has(item.smaregiStoreId),
  );
  const physicalTotalApproved = approved.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const primary = approved.find(
    (item) => item.smaregiStoreId === SMAREGI_PRIMARY_STORE_ID,
  );
  const store1Physical = primary?.quantity ?? 0;
  return {
    physicalTotalApproved,
    store1Physical,
    store1UsableForNewOrder: Math.max(
      0,
      store1Physical - activeReservedQuantity,
    ),
    activeReservedQuantity,
    availableQuantity: Math.max(
      0,
      physicalTotalApproved - activeReservedQuantity,
    ),
  };
};

export const requiresTransferForQuantity = (
  projection: ApprovedInventoryProjection,
  orderQuantity: number,
) => {
  if (!Number.isSafeInteger(orderQuantity) || orderQuantity <= 0)
    throw new AppError(
      'Order quantity must be a positive integer.',
      'INVALID_ORDER_QUANTITY',
      422,
    );
  if (projection.availableQuantity < orderQuantity)
    throw new AppError(
      'Approved-store inventory is insufficient.',
      'INSUFFICIENT_INVENTORY',
      409,
    );
  return projection.store1UsableForNewOrder < orderQuantity;
};
