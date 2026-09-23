import { PaymentStatus } from '@prisma/client';
import { AppError } from '@/lib/errors';
import {
  PaymentRepository,
  PaymentRefundNotAllowedError,
  PaymentStatusChangedError,
} from '@/repositories/payment.repository';
import { EmailDispatchTriggerService } from '@/services/email-dispatch-trigger.service';
import type {
  ProviderPaymentOutcome,
  VerifiedPaymentWebhook,
} from '@/services/payment-adapters/payment-provider.adapter';

const outcomeToPaymentStatus: Record<
  ProviderPaymentOutcome,
  PaymentStatus
> = {
  SUCCEEDED: PaymentStatus.SUCCEEDED,
  FAILED: PaymentStatus.FAILED,
  CANCELLED: PaymentStatus.CANCELLED,
  REFUNDED: PaymentStatus.REFUNDED,
};

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
  REQUIRES_REVIEW: [],
};

const reservationTransitionFor = (status: PaymentStatus) =>
  status === PaymentStatus.SUCCEEDED
    ? ('HOLD' as const)
    : status === PaymentStatus.FAILED ||
        status === PaymentStatus.CANCELLED ||
        status === PaymentStatus.REFUNDED
      ? ('RELEASE' as const)
      : ('NONE' as const);

/**
 * Applies only normalized, adapter-verified provider events. It deliberately
 * owns the Payment/Order/InventoryReservation transition boundary; routes and
 * adapters never write those domain statuses directly.
 */
export class PaymentLifecycleService {
  public constructor(
    private readonly payments = new PaymentRepository(),
    private readonly trigger = new EmailDispatchTriggerService(),
  ) {}

  public async applyVerifiedWebhook(input: VerifiedPaymentWebhook) {
    const existingEvent = await this.payments.findWebhookEvent(
      input.provider,
      input.eventId,
    );
    if (existingEvent)
      return { payment: existingEvent.payment, duplicate: true };

    const payment = await this.payments.findByProviderPaymentId(
      input.provider,
      input.providerPaymentId,
    );
    if (!payment)
      throw new AppError('Payment was not found.', 'PAYMENT_NOT_FOUND', 404);
    // The fallback only supports legacy pre-migration rows during rollout.
    // New rows always persist JPY through the schema default.
    if (input.currency !== (payment.currency ?? 'JPY'))
      throw new AppError(
        'The webhook currency did not match the payment.',
        'PAYMENT_CURRENCY_MISMATCH',
        422,
      );
    if (input.amount !== Number(payment.amount))
      throw new AppError(
        'The webhook amount did not match the payment.',
        'PAYMENT_AMOUNT_MISMATCH',
        422,
      );

    const nextStatus = outcomeToPaymentStatus[input.outcome];
    if (payment.status === nextStatus)
      return { payment, duplicate: true };
    if (!transitions[payment.status].includes(nextStatus)) {
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
      const result = await this.payments.processWebhook({
        ...input,
        paymentId: payment.id,
        expectedStatus: payment.status,
        nextStatus,
        reservationTransition: reservationTransitionFor(nextStatus),
      });
      await this.trigger.trigger();
      return result;
    } catch (error) {
      if (error instanceof PaymentStatusChangedError) {
        throw new AppError(
          'The requested payment status transition is not allowed.',
          'INVALID_PAYMENT_STATUS_TRANSITION',
          409,
        );
      }
      if (error instanceof PaymentRefundNotAllowedError) {
        throw new AppError(
          'A fulfilled order cannot be automatically refunded.',
          'ORDER_ALREADY_FULFILLED',
          409,
        );
      }
      throw error;
    }
  }
}
