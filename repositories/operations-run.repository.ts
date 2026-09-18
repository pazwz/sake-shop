import { Prisma, SyncDirection, SyncStatus } from '@prisma/client';
import { OPERATIONS_SYSTEM } from '@/config/operations';
import { prisma } from '@/lib/prisma';

export class OperationsRunRepository {
  public start(entityType: string) {
    return prisma.syncLog.create({
      data: {
        system: OPERATIONS_SYSTEM,
        entityType,
        entityId: 'SCHEDULER',
        direction: SyncDirection.WEBSITE_TO_SMAREGI,
        action: 'PROCESS',
        status: SyncStatus.PENDING,
        requestPayload: { source: 'INTERNAL_SCHEDULER' },
        startedAt: new Date(),
      },
    });
  }

  public succeed(id: string, summary: Prisma.InputJsonValue) {
    return prisma.syncLog.update({
      where: { id },
      data: {
        status: SyncStatus.SUCCESS,
        responsePayload: summary,
        completedAt: new Date(),
      },
    });
  }

  public fail(id: string, errorMessage: string) {
    return prisma.syncLog.update({
      where: { id },
      data: {
        status: SyncStatus.FAILED,
        errorMessage: errorMessage.slice(0, 250),
        completedAt: new Date(),
      },
    });
  }
}
