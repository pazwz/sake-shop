import { createHash, randomUUID } from 'crypto';
import { EmailTemplate, PaymentStatus, Prisma } from '@prisma/client';
import { getPaymentAdapter } from '@/services/payment-adapters/payment-adapter.factory';
import type {
  PaymentCreateInput,
  PaymentWebhookInput,
} from '@/validators/payment.validator';
import { AppError } from '@/lib/errors';
import { OrderRepository } from '@/repositories/order.repository';
import { CheckoutAccessService } from '@/services/checkout-access.service';
import {
  PaymentRepository,
  PaymentStatusChangedError,
} from '@/repositories/payment.repository';

const transitions: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: [
    PaymentStatus.SUCCEEDED,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  SUCCEEDED: [PaymentStatus.REFUNDED],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const reservationTransitionFor = (status: PaymentStatus) =>
  status === PaymentStatus.SUCCEEDED
    ? ('HOLD' as const)
    : status === PaymentStatus.FAILED ||
        status === PaymentStatus.CANCELLED ||
        status === PaymentStatus.REFUNDED
      ? ('RELEASE' as const)
      : ('NONE' as const);

export class PaymentService {
  constructor(
    private readonly payments = new PaymentRepository(),
    private readonly orders = new OrderRepository(),
    private readonly checkoutAccess = new CheckoutAccessService(),
  ) {}

  async create(input: PaymentCreateInput, customerId: string) {
    this.checkoutAccess.assertMockPaymentAllowed();
    const idempotencyKey = input.idempotencyKey ?? randomUUID();
    const existing = await this.payments.findByIdempotencyKey(idempotencyKey);
    if (existing) return existing;

    const order = input.orderId
      ? await this.orders.findPaymentTargetById(input.orderId, customerId)
      : await this.orders.findPaymentTargetByOrderNumber(
          input.orderNumber!,
          customerId,
        );
    if (!order)
      throw new AppError('Order was not found.', 'ORDER_NOT_FOUND', 404);
    if (order.paymentStatus === PaymentStatus.SUCCEEDED) {
      throw new AppError(
        'This order has already been paid.',
        'ORDER_ALREADY_PAID',
        409,
      );
    }

    const amount = Number(order.totalAmount);
    const adapter = getPaymentAdapter(input.provider);
    const providerResult = await adapter.createPayment({
      provider: input.provider,
      orderNumber: order.orderNumber,
      amount,
    });
    if (providerResult.amount !== amount) {
      throw new AppError(
        'The provider payment amount did not match the order.',
        'PAYMENT_AMOUNT_MISMATCH',
        422,
      );
    }

    try {
      return await this.payments.create({
        order: { connect: { id: order.id } },
        provider: input.provider,
        providerPaymentId: providerResult.providerPaymentId,
        idempotencyKey,
        amount,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate =
          await this.payments.findByIdempotencyKey(idempotencyKey);
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  async handleWebhook(input: PaymentWebhookInput, signature: string | null) {
    this.checkoutAccess.assertMockPaymentAllowed();
    const adapter = getPaymentAdapter(input.provider);
    if (!(await adapter.verifyWebhookSignature(input, signature))) {
      throw new AppError(
        'Webhook signature could not be verified.',
        'INVALID_WEBHOOK',
        401,
      );
    }
    const payment = await this.payments.findByProviderPaymentId(
      input.provider,
      input.providerPaymentId,
    );
    if (!payment)
      throw new AppError('Payment was not found.', 'PAYMENT_NOT_FOUND', 404);
    if (input.amount !== undefined && input.amount !== Number(payment.amount)) {
      throw new AppError(
        'The webhook amount did not match the payment.',
        'PAYMENT_AMOUNT_MISMATCH',
        422,
      );
    }
    if (await this.payments.findWebhookEvent(input.provider, input.eventId)) {
      return { payment, duplicate: true };
    }
    if (payment.status === input.status) return { payment, duplicate: true };
    if (!transitions[payment.status].includes(input.status)) {
      throw new AppError(
        payment.status === PaymentStatus.SUCCEEDED
          ? 'Payment has already been completed.'
          : 'The requested payment status transition is not allowed.',
        payment.status === PaymentStatus.SUCCEEDED
          ? 'PAYMENT_ALREADY_COMPLETED'
          : 'INVALID_PAYMENT_STATUS_TRANSITION',
        409,
      );
    }

    try {
      return await this.payments.processWebhook({
        ...input,
        paymentId: payment.id,
        payloadHash: createHash('sha256')
          .update(
            JSON.stringify({
              provider: input.provider,
              providerPaymentId: input.providerPaymentId,
              eventId: input.eventId,
              status: input.status,
              amount: input.amount,
            }),
          )
          .digest('hex'),
        expectedStatus: payment.status,
        nextStatus: input.status,
        reservationTransition: reservationTransitionFor(input.status),
        emailTemplate:
          input.status === PaymentStatus.SUCCEEDED
            ? EmailTemplate.PAYMENT_SUCCEEDED
            : input.status === PaymentStatus.FAILED ||
                input.status === PaymentStatus.CANCELLED
              ? EmailTemplate.PAYMENT_FAILED
              : null,
      });
    } catch (error) {
      if (error instanceof PaymentStatusChangedError) {
        throw new AppError(
          'The requested payment status transition is not allowed.',
          'INVALID_PAYMENT_STATUS_TRANSITION',
          409,
        );
      }
      throw error;
    }
  }
}
