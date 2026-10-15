import { InventoryReservationStatus, type Prisma } from '@prisma/client';

/** NULL expiry is a confirmed paid hold, not an elapsed unpaid reservation. */
export const effectiveReservationWhere = (now = new Date()) =>
  ({
    status: InventoryReservationStatus.ACTIVE,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  }) satisfies Prisma.InventoryReservationWhereInput;
