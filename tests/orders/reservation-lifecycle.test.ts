import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import {
  getReservationExpiry,
  getReservationTtlMinutes,
} from '@/config/reservation';
import { AppError } from '@/lib/errors';
import { CustomerAddressService } from '@/services/customer-address.service';
import { InventoryReservationService } from '@/services/inventory-reservation.service';
import { OrderService } from '@/services/order.service';
import { PaymentService } from '@/services/payment.service';
import { orderValidator } from '@/validators/order.validator';

test('new reservation expiry uses the centralized bounded TTL', () => {
  const now = new Date('2026-09-13T00:00:00.000Z');
  assert.equal(getReservationTtlMinutes(), 30);
  assert.equal(
    getReservationExpiry(now).toISOString(),
    '2026-09-13T00:30:00.000Z',
  );
});

test('confirm keeps reservation active but removes its timeout exactly once', async () => {
  let active = true;
  const lifecycle = new InventoryReservationService({
    holdForOrder: async () => {
      if (!active) return { count: 0 };
      active = false;
      return { count: 1 };
    },
  } as never);
  assert.deepEqual(await lifecycle.confirmForOrder('order-1'), {
    transitioned: 1,
  });
  assert.deepEqual(await lifecycle.confirmForOrder('order-1'), {
    transitioned: 0,
  });
});

test('due active reservations expire idempotently', async () => {
  let active = true;
  const lifecycle = new InventoryReservationService({
    expireDue: async () => {
      if (!active) return { count: 0 };
      active = false;
      return { count: 2 };
    },
  } as never);
  const now = new Date('2026-09-13T00:31:00.000Z');
  assert.equal((await lifecycle.expireDue(now)).transitioned, 2);
  assert.equal((await lifecycle.expireDue(now)).transitioned, 0);
});

test('order cancellation releases active reservations in the same repository operation', async () => {
  let transition = '';
  const service = new OrderService({
    findById: async () => ({ status: OrderStatus.PENDING }),
    updateStatusWithReservationTransition: async (
      _id: string,
      _status: OrderStatus,
      value: string,
    ) => {
      transition = value;
      return { status: _status };
    },
  } as never);
  await service.updateStatus('order-1', OrderStatus.CANCELLED);
  assert.equal(transition, 'RELEASE');
});

test('completed fulfillment consumes active reservations', async () => {
  let transition = '';
  const service = new OrderService({
    findById: async () => ({ status: OrderStatus.SHIPPED }),
    updateStatusWithReservationTransition: async (
      _id: string,
      _status: OrderStatus,
      value: string,
    ) => {
      transition = value;
      return { status: _status };
    },
  } as never);
  await service.updateStatus('order-1', OrderStatus.COMPLETED);
  assert.equal(transition, 'CONSUME');
});

test('duplicate order cancellation is idempotent', async () => {
  let writes = 0;
  const service = new OrderService({
    findById: async () => ({ status: OrderStatus.CANCELLED }),
    updateStatusWithReservationTransition: async () => {
      writes += 1;
    },
  } as never);
  assert.deepEqual(
    await service.updateStatus('order-1', OrderStatus.CANCELLED),
    {
      status: OrderStatus.CANCELLED,
    },
  );
  assert.equal(writes, 0);
});

test('duplicate success webhook does not transition reservation twice', async () => {
  let writes = 0;
  const payment = {
    id: 'payment-1',
    amount: 1000,
    status: PaymentStatus.SUCCEEDED,
  };
  const service = new PaymentService({
    findByProviderPaymentId: async () => payment,
    findWebhookEvent: async () => null,
    processWebhook: async () => {
      writes += 1;
    },
  } as never);
  const result = await service.handleWebhook(
    {
      provider: PaymentProvider.STERA,
      providerPaymentId: 'mock-stera-payment-1',
      eventId: 'event-2',
      status: PaymentStatus.SUCCEEDED,
    },
    'mock-development-signature',
  );
  assert.equal(result.duplicate, true);
  assert.equal(writes, 0);
});

test('customer address lookup always scopes by customer id', async () => {
  let scope: string[] = [];
  const service = new CustomerAddressService({
    findOwnedAddress: async (customerId: string, addressId: string) => {
      scope = [customerId, addressId];
      return null;
    },
  } as never);
  await assert.rejects(
    () => service.getOwnedAddress('customer-a', 'address-b'),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
  assert.deepEqual(scope, ['customer-a', 'address-b']);
});

test('checkout body rejects forged customerId, customer and email identity', () => {
  const valid = {
    items: [{ productId: 'cm1234567890abcdefghijklmnop', quantity: 1 }],
    address: {
      postalCode: '810-0001',
      prefecture: '福岡県',
      city: '福岡市',
      addressLine1: '1-1',
      recipientName: 'Buyer',
      phone: '09000000000',
    },
    ageConfirmed: true,
    shippingMethod: 'standard',
    paymentMethod: 'card',
  };
  for (const injected of [
    { customerId: 'forged' },
    { customer: { email: 'fake@example.com' } },
    { email: 'fake@example.com' },
  ]) {
    assert.equal(
      orderValidator.safeParse({ ...valid, ...injected }).success,
      false,
    );
  }
});

test('expiration endpoint is protected by CRON_SECRET guard and uses Node runtime', async () => {
  const source = await readFile(
    `${process.cwd()}/app/api/v1/internal/reservations/expire/route.ts`,
    'utf8',
  );
  assert.ok(source.includes('assertCronAuthorization'));
  assert.ok(source.includes("runtime = 'nodejs'"));
});

test('reservation transitions never update InventoryMirror', async () => {
  const sources = await Promise.all([
    readFile(
      `${process.cwd()}/repositories/inventory-reservation.repository.ts`,
      'utf8',
    ),
    readFile(`${process.cwd()}/repositories/payment.repository.ts`, 'utf8'),
  ]);
  assert.ok(
    sources.every((source) => !source.includes('inventoryMirror.update')),
  );
});

test('payment webhook atomically holds success and releases failure', async () => {
  const source = await readFile(
    `${process.cwd()}/repositories/payment.repository.ts`,
    'utf8',
  );
  assert.ok(source.includes('? { expiresAt: null }'));
  assert.ok(source.includes('InventoryReservationStatus.RELEASED'));
  assert.ok(
    source.indexOf('inventoryReservation.updateMany') >
      source.indexOf('$transaction'),
  );
});
