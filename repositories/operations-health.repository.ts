import {
  EmailOutboxStatus,
  EmailTemplate,
  InventoryReservationStatus,
  PaymentStatus,
  SyncStatus,
} from '@prisma/client';
import {
  EMAIL_OUTBOX_OPERATION,
  OPERATIONS_SYSTEM,
  RESERVATION_EXPIRATION_OPERATION,
} from '@/config/operations';
import { SMAREGI_PRODUCTION_SYNC_ENTITY_TYPE } from '@/config/smaregi';
import { prisma } from '@/lib/prisma';

const transactionalTemplates = [
  EmailTemplate.EMAIL_VERIFICATION,
  EmailTemplate.PASSWORD_RESET,
  EmailTemplate.WELCOME,
  EmailTemplate.ORDER_RECEIVED,
  EmailTemplate.PAYMENT_SUCCEEDED,
  EmailTemplate.PAYMENT_FAILED,
  EmailTemplate.ORDER_CANCELLED,
  EmailTemplate.SHIPMENT_SENT,
  EmailTemplate.CONTACT_INQUIRY,
] as const;

export type OperationsRun = {
  status: SyncStatus;
  completedAt: Date | null;
  createdAt: Date;
  responsePayload: unknown;
};

export class OperationsHealthRepository {
  public async getSnapshot(now = new Date()) {
    const staleSendingBefore = new Date(now.getTime() - 10 * 60_000);
    const [
      smaregiRuns,
      reservationRuns,
      emailRuns,
      expiredReservations,
      paymentReview,
      email,
    ] = await Promise.all([
      prisma.syncLog.findMany({
        where: {
          system: 'SMAREGI',
          entityType: SMAREGI_PRODUCTION_SYNC_ENTITY_TYPE,
        },
        select: {
          status: true,
          completedAt: true,
          createdAt: true,
          responsePayload: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      this.findOperationRuns(RESERVATION_EXPIRATION_OPERATION),
      this.findOperationRuns(EMAIL_OUTBOX_OPERATION),
      prisma.inventoryReservation.count({
        where: {
          status: InventoryReservationStatus.ACTIVE,
          expiresAt: { lt: now },
        },
      }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.REQUIRES_REVIEW },
        _count: true,
        _min: { createdAt: true },
      }),
      Promise.all([
        prisma.emailOutbox.count({
          where: { status: EmailOutboxStatus.PENDING },
        }),
        prisma.emailOutbox.count({
          where: {
            status: EmailOutboxStatus.SENDING,
            lockedAt: { lt: staleSendingBefore },
          },
        }),
        prisma.emailOutbox.count({
          where: {
            status: EmailOutboxStatus.FAILED,
            nextAttemptAt: null,
            template: { in: [...transactionalTemplates] },
          },
        }),
        prisma.emailOutbox.count({
          where: {
            status: EmailOutboxStatus.FAILED,
            nextAttemptAt: null,
            template: EmailTemplate.NEWSLETTER_CONTACT_SYNC,
          },
        }),
      ]),
    ]);

    return {
      smaregiRuns,
      reservationRuns,
      emailRuns,
      expiredReservations,
      paymentReviewCount: paymentReview._count,
      oldestPaymentReviewAt: paymentReview._min.createdAt,
      email: {
        pending: email[0],
        stuckSending: email[1],
        terminalTransactionalFailed: email[2],
        terminalNewsletterFailed: email[3],
      },
    };
  }

  private findOperationRuns(entityType: string): Promise<OperationsRun[]> {
    return prisma.syncLog.findMany({
      where: { system: OPERATIONS_SYSTEM, entityType },
      select: {
        status: true,
        completedAt: true,
        createdAt: true,
        responsePayload: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
  }
}
