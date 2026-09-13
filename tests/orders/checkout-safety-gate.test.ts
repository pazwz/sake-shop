import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { getCheckoutRuntimeState } from '@/config/checkout';
import { AppError } from '@/lib/errors';
import { CheckoutAccessService } from '@/services/checkout-access.service';
import { OrderService } from '@/services/order.service';
import { getPaymentAdapter } from '@/services/payment-adapters/payment-adapter.factory';
import { MockPaymentAdapter } from '@/services/payment-adapters/mock-payment.adapter';
import { PaymentService } from '@/services/payment.service';
import { paymentCreateValidator } from '@/validators/payment.validator';

const productionEnvironment = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
} as const;

const expectCheckoutDisabled = async (operation: () => unknown) => {
  await assert.rejects(async () => operation(), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, 'CHECKOUT_DISABLED');
    assert.equal(error.statusCode, 503);
    return true;
  });
};

test('production with disabled mode rejects checkout', async () => {
  const access = new CheckoutAccessService({
    ...productionEnvironment,
    CHECKOUT_MODE: 'disabled',
  });
  await expectCheckoutDisabled(() => access.assertOrderCreationAllowed());
});

test('disabled production checkout does not enter Order persistence', async () => {
  let transactionCalls = 0;
  const service = new OrderService(
    {} as never,
    {
      withLockedProducts: async () => {
        transactionCalls += 1;
        return {};
      },
    } as never,
    new CheckoutAccessService({
      ...productionEnvironment,
      CHECKOUT_MODE: 'disabled',
    }),
  );
  await expectCheckoutDisabled(() => service.create({} as never));
  assert.equal(transactionCalls, 0);
});

test('disabled production checkout creates no InventoryReservation', async () => {
  let reservationCalls = 0;
  const service = new OrderService(
    {} as never,
    {
      withLockedProducts: async () => {
        reservationCalls += 1;
        return {};
      },
    } as never,
    new CheckoutAccessService({
      ...productionEnvironment,
      CHECKOUT_MODE: 'disabled',
    }),
  );
  await expectCheckoutDisabled(() => service.createForCustomer({} as never));
  assert.equal(reservationCalls, 0);
});

test('disabled production payment creates no Payment record', async () => {
  let paymentRepositoryCalls = 0;
  const service = new PaymentService(
    {
      findByIdempotencyKey: async () => {
        paymentRepositoryCalls += 1;
        return null;
      },
    } as never,
    {} as never,
    new CheckoutAccessService({
      ...productionEnvironment,
      CHECKOUT_MODE: 'disabled',
    }),
  );
  await expectCheckoutDisabled(() =>
    service.create({
      orderId: 'cm1234567890abcdefghijklmnop',
      provider: PaymentProvider.STERA,
    }),
  );
  assert.equal(paymentRepositoryCalls, 0);
});

test('disabled production Mock webhook cannot update Payment or Order', async () => {
  let paymentRepositoryCalls = 0;
  const service = new PaymentService(
    {
      findByProviderPaymentId: async () => {
        paymentRepositoryCalls += 1;
        return null;
      },
    } as never,
    {} as never,
    new CheckoutAccessService({
      ...productionEnvironment,
      CHECKOUT_MODE: 'disabled',
    }),
  );
  await expectCheckoutDisabled(() =>
    service.handleWebhook(
      {
        provider: PaymentProvider.STERA,
        providerPaymentId: 'mock-stera-payment',
        eventId: 'mock-event-id',
        status: PaymentStatus.SUCCEEDED,
      },
      'mock-development-signature',
    ),
  );
  assert.equal(paymentRepositoryCalls, 0);
});

test('manual mock provider input and production Mock adapter are rejected', async () => {
  assert.equal(
    paymentCreateValidator.safeParse({
      orderId: 'cm1234567890abcdefghijklmnop',
      provider: 'mock',
    }).success,
    false,
  );
  await expectCheckoutDisabled(() =>
    getPaymentAdapter(PaymentProvider.STERA, {
      ...productionEnvironment,
      CHECKOUT_MODE: 'mock',
    }),
  );
});

test('omitted provider is rejected and cannot select a default Mock adapter', () => {
  assert.equal(
    paymentCreateValidator.safeParse({
      orderNumber: 'LINXAS-20260913-ABC123',
    }).success,
    false,
  );
});

test('direct Mock adapter construction is also blocked in production', async () => {
  const adapter = new MockPaymentAdapter({
    ...productionEnvironment,
    CHECKOUT_MODE: 'mock',
  });
  await expectCheckoutDisabled(() =>
    adapter.createPayment({
      provider: PaymentProvider.STERA,
      orderNumber: 'LINXAS-20260913-ABC123',
      amount: 1000,
    }),
  );
});

test('missing production CHECKOUT_MODE fails closed', () => {
  const state = getCheckoutRuntimeState(productionEnvironment);
  assert.equal(state.checkoutEnabled, false);
  assert.equal(state.mockPaymentEnabled, false);
  assert.equal(state.reason, 'MODE_MISSING');
});

test('production live mode fails closed while real adapters are unavailable', async () => {
  const environment = {
    ...productionEnvironment,
    CHECKOUT_MODE: 'live',
  } as const;
  const state = getCheckoutRuntimeState(environment);
  assert.equal(state.checkoutEnabled, false);
  assert.equal(state.reason, 'LIVE_PAYMENT_UNAVAILABLE');
  await expectCheckoutDisabled(() =>
    getPaymentAdapter(PaymentProvider.PAYPAY, environment),
  );
});

test('local development defaults to the existing Mock checkout', async () => {
  const environment = { NODE_ENV: 'development' } as const;
  const state = getCheckoutRuntimeState(environment);
  assert.equal(state.checkoutEnabled, true);
  assert.equal(state.effectiveMode, 'mock');
  const adapter = getPaymentAdapter(PaymentProvider.STERA, environment);
  assert.ok(adapter instanceof MockPaymentAdapter);
  const payment = await adapter.createPayment({
    provider: PaymentProvider.STERA,
    orderNumber: 'LINXAS-20260913-ABC123',
    amount: 1000,
  });
  assert.equal(payment.amount, 1000);
});

test('Preview is disabled by default and allows Mock only when explicit', () => {
  const preview = {
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
  } as const;
  assert.equal(getCheckoutRuntimeState(preview).checkoutEnabled, false);
  assert.equal(
    getCheckoutRuntimeState({ ...preview, CHECKOUT_MODE: 'mock' })
      .checkoutEnabled,
    true,
  );
});

test('Cart remains usable and still links to Checkout', async () => {
  const source = await readFile(`${process.cwd()}/app/cart/page.tsx`, 'utf8');
  assert.ok(source.includes('update(lineId, q)'));
  assert.ok(source.includes('remove(lineId)'));
  assert.ok(source.includes("'/checkout'"));
});

test('production Checkout page renders the preparation message', async () => {
  const source = await readFile(
    `${process.cwd()}/components/checkout-form.tsx`,
    'utf8',
  );
  assert.ok(source.includes('オンライン注文は現在準備中です'));
  assert.ok(source.includes('if (!checkoutEnabled)'));
});

test('disabled Checkout renders a disabled submit control', async () => {
  const source = await readFile(
    `${process.cwd()}/components/checkout-form.tsx`,
    'utf8',
  );
  const disabledState = source.slice(
    source.indexOf('if (!checkoutEnabled)'),
    source.indexOf('if (!ready || !member)'),
  );
  assert.ok(disabledState.includes('disabled'));
  assert.ok(disabledState.includes('注文受付準備中'));
});

test('direct Order POST is gated before request parsing or Service writes', async () => {
  const source = await readFile(
    `${process.cwd()}/app/api/v1/orders/route.ts`,
    'utf8',
  );
  const gateIndex = source.indexOf('assertOrderCreationAllowed()');
  assert.ok(gateIndex >= 0);
  assert.ok(gateIndex < source.indexOf('request.json()'));
  assert.ok(gateIndex < source.indexOf('createForCustomer'));
  assert.equal(source.includes('searchParams'), false);
});

test('direct Payment POST reaches the guarded Payment Service only', async () => {
  const [routeSource, serviceSource] = await Promise.all([
    readFile(`${process.cwd()}/app/api/v1/payments/create/route.ts`, 'utf8'),
    readFile(`${process.cwd()}/services/payment.service.ts`, 'utf8'),
  ]);
  assert.ok(routeSource.includes('service.create'));
  assert.ok(serviceSource.includes('assertMockPaymentAllowed()'));
  assert.ok(
    serviceSource.indexOf('assertMockPaymentAllowed()') <
      serviceSource.indexOf('findByIdempotencyKey'),
  );
});

test('Admin Order route remains independent from the Checkout gate', async () => {
  const source = await readFile(
    `${process.cwd()}/app/api/v1/admin/orders/[id]/route.ts`,
    'utf8',
  );
  assert.ok(source.includes('await requireAdmin()'));
  assert.ok(source.includes('getAdminOrder'));
  assert.equal(source.includes('CheckoutAccessService'), false);
});

test('Smaregi production sync remains independent from Checkout mode', async () => {
  const source = await readFile(
    `${process.cwd()}/services/smaregi/production-smaregi-sync.service.ts`,
    'utf8',
  );
  assert.equal(source.includes('CHECKOUT_MODE'), false);
  assert.equal(source.includes('CheckoutAccessService'), false);
});
