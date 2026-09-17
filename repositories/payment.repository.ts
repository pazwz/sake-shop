import { createHash } from 'node:crypto';
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
import type {
  PaymentCurrency,
  ProviderPaymentOutcome,
} from '@/services/payment-adapters/payment-provider.adapter';

export class PaymentStatusChangedError extends Error {}
export class PaymentRefundNotAllowedError extends Error {}

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
      include: { payment: true },
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
    eventType: string;
    paymentId: string;
    expectedStatus: PaymentStatus;
    nextStatus: PaymentStatus;
    providerPaymentId: string;
    amount: number;
    currency: PaymentCurrency;
    outcome: ProviderPaymentOutcome;
    reservationTransition: 'NONE' | 'HOLD' | 'RELEASE';
  }) {
    try {
      return await this.database.$transaction(
        async (tx) => {
          const event = await tx.paymentWebhookEvent.create({
            data: {
              provider: input.provider,
              eventId: input.eventId,
              paymentId: input.paymentId,
              payloadHash: createWebhookPayloadHash(input),
            },
          });
          const currentPayment = await tx.payment.findUniqueOrThrow({
            where: { id: input.paymentId },
          });
          const currentOrder = await tx.order.findUniqueOrThrow({
            where: { id: currentPayment.orderId },
            select: { status: true },
          });
          if (
            input.nextStatus === PaymentStatus.REFUNDED &&
            (currentOrder.status === OrderStatus.SHIPPED ||
              currentOrder.status === OrderStatus.COMPLETED)
          ) {
            throw new PaymentRefundNotAllowedError();
          }
          const reservationCount = await tx.inventoryReservation.count({
            where: { orderId: currentPayment.orderId },
          });
          const hasInactiveReservation =
            input.nextStatus === PaymentStatus.SUCCEEDED &&
            (await tx.inventoryReservation.count({
              where: {
                orderId: currentPayment.orderId,
                status: { not: InventoryReservationStatus.ACTIVE },
              },
            })) > 0;
          // A late provider success must never revive expired or released stock.
          // Legacy orders without a reservation are also held for manual review.
          const nextStatus =
            input.nextStatus === PaymentStatus.SUCCEEDED &&
            (reservationCount === 0 || hasInactiveReservation)
            ? PaymentStatus.REQUIRES_REVIEW
            : input.nextStatus;
          const updated = await tx.payment.updateMany({
            where: { id: input.paymentId, status: input.expectedStatus },
            data: {
              status: nextStatus,
              ...(nextStatus === PaymentStatus.SUCCEEDED
                ? { paidAt: new Date() }
                : {}),
              ...(nextStatus === PaymentStatus.FAILED
                ? { failedAt: new Date() }
                : {}),
              ...(nextStatus === PaymentStatus.CANCELLED
                ? { cancelledAt: new Date() }
                : {}),
            },
          });
          if (updated.count !== 1) throw new PaymentStatusChangedError();

          const payment = await tx.payment.findUniqueOrThrow({
            where: { id: input.paymentId },
          });
          if (nextStatus === PaymentStatus.SUCCEEDED) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: {
                paymentStatus: PaymentStatus.SUCCEEDED,
                status: OrderStatus.PAID,
              },
            });
          } else if (nextStatus === PaymentStatus.REQUIRES_REVIEW) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: { paymentStatus: PaymentStatus.REQUIRES_REVIEW },
            });
          } else if (nextStatus === PaymentStatus.REFUNDED) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: {
                paymentStatus: PaymentStatus.REFUNDED,
                status: OrderStatus.REFUNDED,
              },
            });
          } else if (
            nextStatus === PaymentStatus.FAILED ||
            nextStatus === PaymentStatus.CANCELLED
          ) {
            await tx.order.update({
              where: { id: payment.orderId },
              data: { paymentStatus: input.nextStatus },
            });
          }
          if (
            input.reservationTransition !== 'NONE' &&
            nextStatus !== PaymentStatus.REQUIRES_REVIEW
          ) {
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
              action: `WEBHOOK_${nextStatus}`,
              status: SyncStatus.SUCCESS,
              responsePayload: {
                provider: input.provider,
                providerPaymentId: input.providerPaymentId,
                eventType: input.eventType,
                outcome: input.outcome,
                status: nextStatus,
                amount: input.amount,
                currency: input.currency,
              },
              completedAt: new Date(),
            },
          });
          const emailTemplate =
            nextStatus === PaymentStatus.SUCCEEDED
              ? EmailTemplate.PAYMENT_SUCCEEDED
              : nextStatus === PaymentStatus.FAILED ||
                  nextStatus === PaymentStatus.CANCELLED
                ? EmailTemplate.PAYMENT_FAILED
                : null;
          if (emailTemplate) {
            const order = await tx.order.findUniqueOrThrow({
              where: { id: payment.orderId },
              include: { customer: true },
            });
            await tx.emailOutbox.upsert({
              where: {
                eventKey: `payment:${payment.id}:${nextStatus}`,
              },
              update: {},
              create: {
                eventKey: `payment:${payment.id}:${input.nextStatus}`,
                type: `PAYMENT_${nextStatus}`,
                recipient: order.customer.email,
                subject:
                  emailTemplate === EmailTemplate.PAYMENT_SUCCEEDED
                    ? 'お支払いを確認しました'
                    : 'お支払いを確認できませんでした',
                template: emailTemplate,
                payload: {
                  orderNumber: order.orderNumber,
                  totalAmount: Number(order.totalAmount),
                },
              },
            });
          }
          return {
            payment: await tx.payment.findUniqueOrThrow({
              where: { id: input.paymentId },
            }),
            duplicate: false,
            requiresManualReview: nextStatus === PaymentStatus.REQUIRES_REVIEW,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const event = await this.findWebhookEvent(input.provider, input.eventId);
        if (event) return { payment: event.payment, duplicate: true };
      }
      throw error;
    }
  }
}

const createWebhookPayloadHash = (input: {
  provider: PaymentProvider;
  providerPaymentId: string;
  eventId: string;
  eventType: string;
  outcome: ProviderPaymentOutcome;
  amount: number;
  currency: PaymentCurrency;
}) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        eventId: input.eventId,
        eventType: input.eventType,
        outcome: input.outcome,
        amount: input.amount,
        currency: input.currency,
      }),
    )
    .digest('hex');
