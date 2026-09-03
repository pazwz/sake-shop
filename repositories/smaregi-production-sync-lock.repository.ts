import { Prisma } from '@prisma/client';
import {
  SMAREGI_PRODUCTION_SYNC_LOCK_KEY,
  SMAREGI_PRODUCTION_SYNC_MAX_DURATION_SECONDS,
} from '@/config/smaregi';
import { prisma } from '@/lib/prisma';

export type SmaregiSyncLockResult<T> =
  | { acquired: false }
  | { acquired: true; value: T };

type LockDatabase = {
  $transaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
    options: { maxWait: number; timeout: number },
  ): Promise<T>;
};

export class SmaregiProductionSyncLockRepository {
  public constructor(private readonly database: LockDatabase = prisma) {}

  public async withLock<T>(
    operation: () => Promise<T>,
  ): Promise<SmaregiSyncLockResult<T>> {
    return this.database.$transaction(
      async (transaction) => {
        const [row] = await transaction.$queryRaw<Array<{ acquired: boolean }>>(
          Prisma.sql`SELECT pg_try_advisory_xact_lock(${SMAREGI_PRODUCTION_SYNC_LOCK_KEY}) AS acquired`,
        );
        if (row?.acquired !== true) return { acquired: false };
        return { acquired: true, value: await operation() };
      },
      {
        maxWait: 10_000,
        timeout: (SMAREGI_PRODUCTION_SYNC_MAX_DURATION_SECONDS + 10) * 1000,
      },
    );
  }
}
