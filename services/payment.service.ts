import { randomUUID } from 'crypto';
import { PaymentStatus, Prisma } from '@prisma/client';
import { getPaymentAdapter } from '@/services/payment-adapters/payment-adapter.factory';
import type {
  PaymentCreateInput,
  PaymentWebhookInput,
} from '@/validators/payment.validator';
import { AppError } from '@/lib/errors';
import { OrderRepository } from '@/repositories/order.repository';
import { CheckoutAccessService } from '@/services/checkout-access.service';
import { PaymentRepository } from '@/repositories/payment.repository';
import { PaymentLifecycleService } from '@/services/payment-lifecycle.service';

export class PaymentService {
  constructor(
    private readonly payments = new PaymentRepository(),
    private readonly orders = new OrderRepository(),
    private readonly checkoutAccess = new CheckoutAccessService(),
    private readonly lifecycle = new PaymentLifecycleService(payments),
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
      currency: 'JPY',
    });
    if (providerResult.amount !== amount) {
      throw new AppError(
        'The provider payment amount did not match the order.',
        'PAYMENT_AMOUNT_MISMATCH',
        422,
      );
    }
    if (providerResult.currency !== 'JPY') {
      throw new AppError(
        'The provider payment currency did not match the order.',
        'PAYMENT_CURRENCY_MISMATCH',
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
        currency: providerResult.currency,
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
    return this.lifecycle.applyVerifiedWebhook(adapter.normalizeWebhook(input));
  }
}
