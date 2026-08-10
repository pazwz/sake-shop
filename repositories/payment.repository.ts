import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  SyncDirection,
  SyncStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

const include = { order: true } satisfies Prisma.PaymentInclude;

export class PaymentStatusChangedError extends Error {}

export class PaymentRepository {
  findById(id: string) {
    return prisma.payment.findUnique({ where: { id }, include });
  }

  findByOrderId(orderId: string) {
    return prisma.payment.findMany({
      where: { orderId },
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  findByProviderPaymentId(
    provider: PaymentProvider,
    providerPaymentId: string,
  ) {
    return prisma.payment.findUnique({
      where: { provider_providerPaymentId: { provider, providerPaymentId } },
      include,
    });
  }

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.payment.findUnique({ where: { idempotencyKey }, include });
  }

  findWebhookEvent(provider: PaymentProvider, eventId: string) {
    return prisma.paymentWebhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId } },
    });
  }

  create(data: Prisma.PaymentCreateInput) {
    return prisma.payment.create({ data, include });
  }

  updateStatus(id: string, status: PaymentStatus) {
    return prisma.payment.update({ where: { id }, data: { status }, include });
  }

  markSucceeded(id: string) {
    return prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
      include,
    });
  }

  markFailed(id: string) {
    return prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.FAILED, failedAt: new Date() },
      include,
    });
  }

  markCancelled(id: string) {
    return prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.CANCELLED, cancelledAt: new Date() },
      include,
    });
  }

  markRefunded(id: string) {
    return prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.REFUNDED },
      include,
    });
  }

  async processWebhook(input: {
    provider: PaymentProvider;
    eventId: string;
    paymentId: string;
    payloadHash: string;
    expectedStatus: PaymentStatus;
    nextStatus: PaymentStatus;
    providerPaymentId: string;
  }) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const event = await tx.paymentWebhookEvent.create({
            data: {
              provider: input.provider,
              eventId: input.eventId,
              paymentId: input.paymentId,
              payloadHash: input.payloadHash,
            },
          });
          const updated = await tx.payment.updateMany({
            where: { id: input.paymentId, status: input.expectedStatus },
            data: {
              status: input.nextStatus,
              ...(input.nextStatus === PaymentStatus.SUCCEEDED
                ? { paidAt: new Date() }
                : {}),
              ...(input.nextStatus === PaymentStatus.FAILED
                ? { failedAt: new Date() }
                : {}),
              ...(input.nextStatus === PaymentStatus.CANCELLED
                ? { cancelledAt: new Date() }
                : {}),
            },
          });
          if (updated.count !== 1) throw new PaymentStatusChangedError();

          const payment = await tx.payment.findUniqueOrThrow({
            where: { id: input.paymentId },
            include,
          });
          if (input.nextStatus === PaymentStatus.SUCCEEDED) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: {
                paymentStatus: PaymentStatus.SUCCEEDED,
                status: OrderStatus.PAID,
              },
            });
          } else if (input.nextStatus === PaymentStatus.REFUNDED) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: { paymentStatus: PaymentStatus.REFUNDED },
            });
          }
          await tx.paymentWebhookEvent.update({
            where: { id: event.id },
            data: { processedAt: new Date() },
          });
          await tx.syncLog.create({
            data: {
              system: 'PAYMENT',
              entityType: 'Payment',
              entityId: input.paymentId,
              direction: SyncDirection.WEBSITE_TO_SMAREGI,
              action: `WEBHOOK_${input.nextStatus}`,
              status: SyncStatus.SUCCESS,
              responsePayload: {
                provider: input.provider,
                providerPaymentId: input.providerPaymentId,
                status: input.nextStatus,
              },
              completedAt: new Date(),
            },
          });
          return { payment, duplicate: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const payment = await this.findById(input.paymentId);
        return { payment, duplicate: true };
      }
      throw error;
    }
  }
}
