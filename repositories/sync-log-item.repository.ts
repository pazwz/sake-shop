import { Prisma, SyncLogItemType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type SyncLogItemInput = {
  type: SyncLogItemType;
  smaregiProductId?: string | null;
  productCode?: string | null;
  productName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  reason?: string | null;
  changes?: Prisma.InputJsonValue | null;
};

export class SyncLogItemRepository {
  public createMany(syncLogId: string, items: readonly SyncLogItemInput[]) {
    if (items.length === 0) return Promise.resolve({ count: 0 });
    return prisma.syncLogItem.createMany({
      data: items.map(({ changes, ...item }) => ({
        syncLogId,
        ...item,
        ...(changes === null ? {} : { changes }),
      })),
    });
  }

  public findBySyncLogId(syncLogId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    return prisma.$transaction(async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.syncLogItem.findMany({
          where: { syncLogId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip,
          take: limit,
        }),
        transaction.syncLogItem.count({ where: { syncLogId } }),
      ]);
      return { items, total };
    });
  }

  public deleteOlderThan(threshold: Date) {
    return prisma.syncLogItem.deleteMany({
      where: { createdAt: { lt: threshold } },
    });
  }
}
