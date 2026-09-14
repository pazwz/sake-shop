import {
  InventoryReservationStatus,
  EmailTemplate,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  SyncDirection,
  SyncStatus,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class PaymentStatusChangedError extends Error {}

export class PaymentRepository {
  public constructor(private readonly database: PrismaClient = prisma) {}

  findById(id: string) {
    return this.database.payment.findUnique({ where: { id } });
  }

  findByOrderId(orderId: string) {
    return this.database.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByProviderPaymentId(
    provider: PaymentProvider,
    providerPaymentId: string,
  ) {
    return this.database.payment.findUnique({
      where: { provider_providerPaymentId: { provider, providerPaymentId } },
    });
  }

  findByIdempotencyKey(idempotencyKey: string) {
    return this.database.payment.findUnique({ where: { idempotencyKey } });
  }

  findWebhookEvent(provider: PaymentProvider, eventId: string) {
    return this.database.paymentWebhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId } },
    });
  }

  create(data: Prisma.PaymentCreateInput) {
    return this.database.payment.create({ data });
  }

  updateStatus(id: string, status: PaymentStatus) {
    return this.database.payment.update({ where: { id }, data: { status } });
  }

  markSucceeded(id: string) {
    return this.database.payment.update({
      where: { id },
      data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
    });
  }

  markFailed(id: string) {
    return this.database.payment.update({
      where: { id },
      data: { status: PaymentStatus.FAILED, failedAt: new Date() },
    });
  }

  markCancelled(id: string) {
    return this.database.payment.update({
      where: { id },
      data: { status: PaymentStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  markRefunded(id: string) {
    return this.database.payment.update({
      where: { id },
      data: { status: PaymentStatus.REFUNDED },
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
    reservationTransition: 'NONE' | 'HOLD' | 'RELEASE';
    emailTemplate: EmailTemplate | null;
  }) {
    try {
      return await this.database.$transaction(
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
          } else if (
            input.nextStatus === PaymentStatus.FAILED ||
            input.nextStatus === PaymentStatus.CANCELLED
          ) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: { paymentStatus: input.nextStatus },
            });
          }
          if (input.reservationTransition !== 'NONE') {
            await tx.inventoryReservation.updateMany({
              where: {
                orderId: payment.orderId,
                status: InventoryReservationStatus.ACTIVE,
              },
              data:
                input.reservationTransition === 'HOLD'
                  ? { expiresAt: null }
                  : { status: InventoryReservationStatus.RELEASED },
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
          if (input.emailTemplate) {
            const order = await tx.order.findUniqueOrThrow({
              where: { id: payment.orderId },
              include: { customer: true },
            });
            await tx.emailOutbox.upsert({
              where: {
                eventKey: `payment:${payment.id}:${input.nextStatus}`,
              },
              update: {},
              create: {
                eventKey: `payment:${payment.id}:${input.nextStatus}`,
                type: `PAYMENT_${input.nextStatus}`,
                recipient: order.customer.email,
                subject:
                  input.emailTemplate === EmailTemplate.PAYMENT_SUCCEEDED
                    ? 'お支払いを確認しました'
                    : 'お支払いを確認できませんでした',
                template: input.emailTemplate,
                payload: {
                  orderNumber: order.orderNumber,
                  totalAmount: Number(order.totalAmount),
                },
              },
            });
          }
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
