import { Prisma, SyncDirection, SyncStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class SyncRepository {
  public start(
    entityType: string,
    entityId: string,
    action: string,
    direction: SyncDirection = SyncDirection.SMAREGI_TO_WEBSITE,
    requestPayload: Prisma.InputJsonValue = { mode: 'FULL' },
  ) {
    return prisma.syncLog.create({
      data: {
        system: 'SMAREGI',
        entityType,
        entityId,
        direction,
        action,
        status: SyncStatus.PENDING,
        requestPayload,
        startedAt: new Date(),
      },
    });
  }

  public succeed(
    id: string,
    responsePayload: Prisma.InputJsonValue,
    retryCount = 0,
  ) {
    return prisma.syncLog.update({
      where: { id },
      data: {
        status: SyncStatus.SUCCESS,
        responsePayload,
        retryCount,
        completedAt: new Date(),
      },
    });
  }

  public fail(id: string, errorMessage: string, retryCount = 0) {
    return prisma.syncLog.update({
      where: { id },
      data: {
        status: SyncStatus.FAILED,
        errorMessage,
        retryCount,
        completedAt: new Date(),
      },
    });
  }

  public findRecent(limit = 20) {
    return prisma.syncLog.findMany({
      where: { system: 'SMAREGI' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  public findLast(entityType: string) {
    return prisma.syncLog.findFirst({
      where: { system: 'SMAREGI', entityType },
      orderBy: { createdAt: 'desc' },
    });
  }
}
