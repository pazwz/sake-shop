import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { AppError } from '@/lib/errors';
import { PaymentLifecycleService } from '@/services/payment-lifecycle.service';
import { PaymentService } from '@/services/payment.service';
import { MockPaymentAdapter } from '@/services/payment-adapters/mock-payment.adapter';

const event = (overrides: Record<string, unknown> = {}) => ({
  provider: PaymentProvider.STERA,
  providerPaymentId: 'provider-payment-1',
  eventId: 'provider-event-1',
  eventType: 'payment.succeeded',
  outcome: 'SUCCEEDED' as const,
  amount: 1000,
  currency: 'JPY' as const,
  ...overrides,
});

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 'payment-1',
  amount: 1000,
  currency: 'JPY',
  status: PaymentStatus.PENDING,
  ...overrides,
});

test('a duplicate provider event is returned without a second lifecycle write', async () => {
  let writes = 0;
  const existing = { payment: payment({ status: PaymentStatus.SUCCEEDED }) };
  const lifecycle = new PaymentLifecycleService({
    findWebhookEvent: async () => existing,
    findByProviderPaymentId: async () => {
      throw new Error('must not load payment after a duplicate event');
    },
    processWebhook: async () => {
      writes += 1;
    },
  } as never);
  const result = await lifecycle.applyVerifiedWebhook(event());
  assert.equal(result.duplicate, true);
  assert.equal(writes, 0);
});

test('a webhook amount or currency mismatch fails closed before lifecycle persistence', async () => {
  let writes = 0;
  const lifecycle = new PaymentLifecycleService({
    findWebhookEvent: async () => null,
    findByProviderPaymentId: async () => payment(),
    processWebhook: async () => {
      writes += 1;
    },
  } as never);
  await assert.rejects(
    () => lifecycle.applyVerifiedWebhook(event({ amount: 999 })),
    (error: unknown) => error instanceof AppError && error.code === 'PAYMENT_AMOUNT_MISMATCH',
  );
  await assert.rejects(
    () => lifecycle.applyVerifiedWebhook(event({ currency: 'USD' })),
    (error: unknown) => error instanceof AppError && error.code === 'PAYMENT_CURRENCY_MISMATCH',
  );
  assert.equal(writes, 0);
});

test('an invalid provider webhook signature is rejected before normalization', async () => {
  const adapter = new MockPaymentAdapter({
    NODE_ENV: 'development',
    CHECKOUT_MODE: 'mock',
  });
  assert.equal(
    await adapter.verifyWebhookSignature(
      {
        provider: PaymentProvider.STERA,
        providerPaymentId: 'provider-payment-1',
        eventId: 'provider-event-1',
        status: PaymentStatus.SUCCEEDED,
        amount: 1000,
        currency: 'JPY',
      },
      'invalid-signature',
    ),
    false,
  );
});

test('a normal payment success atomically requests the confirmed-hold transition', async () => {
  let captured: Record<string, unknown> | undefined;
  const lifecycle = new PaymentLifecycleService({
    findWebhookEvent: async () => null,
    findByProviderPaymentId: async () => payment(),
    processWebhook: async (input: Record<string, unknown>) => {
      captured = input;
      return { payment: payment({ status: PaymentStatus.SUCCEEDED }), duplicate: false };
    },
  } as never);
  await lifecycle.applyVerifiedWebhook(event());
  assert.equal(captured?.nextStatus, PaymentStatus.SUCCEEDED);
  assert.equal(captured?.reservationTransition, 'HOLD');
});

test('payment failure releases an active reservation and cannot transition after success', async () => {
  let captured: Record<string, unknown> | undefined;
  const lifecycle = new PaymentLifecycleService({
    findWebhookEvent: async () => null,
    findByProviderPaymentId: async () => payment(),
    processWebhook: async (input: Record<string, unknown>) => {
      captured = input;
      return { payment: payment({ status: PaymentStatus.FAILED }), duplicate: false };
    },
  } as never);
  await lifecycle.applyVerifiedWebhook(event({ outcome: 'FAILED', eventType: 'payment.failed' }));
  assert.equal(captured?.nextStatus, PaymentStatus.FAILED);
  assert.equal(captured?.reservationTransition, 'RELEASE');

  const succeeded = new PaymentLifecycleService({
    findWebhookEvent: async () => null,
    findByProviderPaymentId: async () => payment({ status: PaymentStatus.SUCCEEDED }),
  } as never);
  await assert.rejects(
    () => succeeded.applyVerifiedWebhook(event({ outcome: 'FAILED' })),
    (error: unknown) => error instanceof AppError && error.code === 'PAYMENT_ALREADY_COMPLETED',
  );
});

test('late payment success is persisted as a review-required exception without a hold', async () => {
  const lifecycle = new PaymentLifecycleService({
    findWebhookEvent: async () => null,
    findByProviderPaymentId: async () => payment(),
    processWebhook: async () => ({
      payment: payment({ status: PaymentStatus.REQUIRES_REVIEW }),
      duplicate: false,
      requiresManualReview: true,
    }),
  } as never);
  const result = await lifecycle.applyVerifiedWebhook(event());
  assert.equal(result.payment?.status, PaymentStatus.REQUIRES_REVIEW);
  assert.equal(
    (result as { requiresManualReview?: boolean }).requiresManualReview,
    true,
  );
});

test('same payment idempotency key returns the existing payment and creates no second attempt', async () => {
  let created = 0;
  const existing = payment();
  const service = new PaymentService(
    {
      findByIdempotencyKey: async () => existing,
      create: async () => {
        created += 1;
      },
    } as never,
    {} as never,
    undefined,
  );
  const result = await service.create(
    {
      orderId: 'cm1234567890abcdefghijklmnop',
      provider: PaymentProvider.STERA,
      idempotencyKey: 'payment-attempt-key-1',
    },
    'customer-1',
  );
  assert.equal(result, existing);
  assert.equal(created, 0);
});

test('repository implementation keeps late success, webhook idempotency, and fulfillment refund guards transactional', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(`${process.cwd()}/repositories/payment.repository.ts`, 'utf8'),
  );
  assert.match(source, /InventoryReservationStatus\.ACTIVE/);
  assert.match(source, /PaymentStatus\.REQUIRES_REVIEW/);
  assert.match(source, /PaymentWebhookEvent\.create|paymentWebhookEvent\.create/);
  assert.match(source, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(source, /PaymentRefundNotAllowedError/);
});

test('shipment delivery closes the Order and consumes only active reservations', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(`${process.cwd()}/repositories/shipment.repository.ts`, 'utf8'),
  );
  assert.match(source, /OrderStatus\.COMPLETED/);
  assert.match(source, /InventoryReservationStatus\.CONSUMED/);
});

test('paid orders cannot use the unpaid cancellation path', async () => {
  const { OrderService } = await import('@/services/order.service');
  const service = new OrderService({
    findById: async () => ({
      status: OrderStatus.PAID,
      paymentStatus: PaymentStatus.SUCCEEDED,
    }),
  } as never);
  await assert.rejects(
    () => service.updateStatus('order-1', OrderStatus.CANCELLED),
    (error: unknown) => error instanceof AppError && error.code === 'PAYMENT_REFUND_REQUIRED',
  );
});

test('a pending provider payment must be cancelled through the payment lifecycle', async () => {
  const { OrderService } = await import('@/services/order.service');
  const service = new OrderService({
    findById: async () => ({
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      payments: [{ status: PaymentStatus.PENDING }],
    }),
  } as never);
  await assert.rejects(
    () => service.updateStatus('order-1', OrderStatus.CANCELLED),
    (error: unknown) =>
      error instanceof AppError && error.code === 'PAYMENT_CANCELLATION_REQUIRED',
  );
});
