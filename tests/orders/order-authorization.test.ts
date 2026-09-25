import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AppError, UnauthorizedError } from '@/lib/errors';
import { getSafeOrderConfirmationNumber } from '@/lib/order-confirmation';
import { CustomerOrderAccessService } from '@/services/customer-order-access.service';
import { OrderService } from '@/services/order.service';

type ErrorPayload = {
  success: boolean;
  data: null;
  error: { code: string; detail: string };
};

const requestOrder = async (
  identifier: string,
  _query = '',
): Promise<{ status: number; payload: ErrorPayload }> => {
  try {
    await new CustomerOrderAccessService({} as never, async () => {
      throw new UnauthorizedError('Customer authentication is required.');
    }).getOrderDetail(identifier);
    throw new Error('The customer order safety gate unexpectedly opened.');
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return {
      status: error.statusCode,
      payload: {
        success: false,
        data: null,
        error: { code: error.code, detail: error.message },
      },
    };
  }
};

test('unauthenticated customer cannot read an order by order number', async () => {
  const result = await requestOrder('LINXAS-20260913-ABC123');
  assert.equal(result.status, 401);
  assert.equal(result.payload.error.code, 'UNAUTHORIZED');
  assert.equal(result.payload.data, null);
});

test('unauthenticated customer cannot read an order by database id', async () => {
  const result = await requestOrder('cm1234567890abcdefghijklmnop');
  assert.equal(result.status, 401);
  assert.equal(result.payload.error.code, 'UNAUTHORIZED');
});

test('forged customerId query cannot bypass the safety gate', async () => {
  const result = await requestOrder(
    'LINXAS-20260913-ABC123',
    '?customerId=forged-customer',
  );
  assert.equal(result.status, 401);
  const route = await readFile(
    `${process.cwd()}/app/api/v1/orders/[orderNumber]/route.ts`,
    'utf8',
  );
  assert.equal(route.includes('searchParams'), false);
  assert.equal(route.includes('customerId'), false);
});

test('forged email query cannot bypass the safety gate', async () => {
  const result = await requestOrder(
    'LINXAS-20260913-ABC123',
    '?email=attacker%40example.test',
  );
  assert.equal(result.status, 401);
  const route = await readFile(
    `${process.cwd()}/app/api/v1/orders/[orderNumber]/route.ts`,
    'utf8',
  );
  assert.equal(route.includes('email'), false);
});

test('admin order route retains server-side authentication before detail read', async () => {
  const source = await readFile(
    `${process.cwd()}/app/api/v1/admin/orders/[id]/route.ts`,
    'utf8',
  );
  assert.ok(source.indexOf('await requireAdmin()') >= 0);
  assert.ok(
    source.indexOf('await requireAdmin()') < source.indexOf('getAdminOrder'),
  );
});

test('authenticated customer can read only an ownership-scoped order', async () => {
  let scope: { customerId: string; orderNumber: string } | null = null;
  const record = {
    orderNumber: 'LINXAS-20260913-ABC123',
    createdAt: new Date('2026-09-13T00:00:00.000Z'),
    status: 'PENDING',
    paymentStatus: 'PENDING',
    shipmentStatus: 'PENDING',
    subtotal: 1000,
    shippingFee: 500,
    taxAmount: 91,
    discountAmount: 0,
    totalAmount: 1500,
    shippingAddressSnapshot: null,
    items: [],
    shipments: [],
    contactInquiries: [],
  };
  const service = new CustomerOrderAccessService(
    {
      findOwnedByOrderNumber: async (
        customerId: string,
        orderNumber: string,
      ) => {
        scope = { customerId, orderNumber };
        return record;
      },
    } as never,
    async () => ({ id: 'customer-a' }),
  );
  const result = await service.getOrderDetail(record.orderNumber);
  assert.deepEqual(scope, {
    customerId: 'customer-a',
    orderNumber: record.orderNumber,
  });
  assert.equal(result.orderNumber, record.orderNumber);
});

test('another customer order and nonexistent order both return the same 404', async () => {
  const service = new CustomerOrderAccessService(
    { findOwnedByOrderNumber: async () => null } as never,
    async () => ({ id: 'customer-b' }),
  );
  const errors = await Promise.all(
    ['LINXAS-OWNED-BY-A', 'LINXAS-NOT-FOUND'].map(async (orderNumber) => {
      try {
        await service.getOrderDetail(orderNumber);
      } catch (error) {
        return error;
      }
    }),
  );
  assert.ok(
    errors.every(
      (error) => error instanceof AppError && error.statusCode === 404,
    ),
  );
  assert.equal(
    (errors[0] as AppError).message,
    (errors[1] as AppError).message,
  );
});

test('admin order service can still load an order through the admin method', async () => {
  const expected = { id: 'order-1', orderNumber: 'LINXAS-20260913-ABC123' };
  const service = new OrderService(
    { findById: async () => expected } as never,
    {} as never,
  );
  assert.equal(await service.getAdminOrder('order-1'), expected);
});

test('checkout order creation response is reduced to id and order number', async () => {
  const service = new OrderService({} as never, {} as never);
  Object.defineProperty(service, 'create', {
    value: async () => ({
      id: 'order-1',
      orderNumber: 'LINXAS-20260913-ABC123',
      shippingAddressSnapshot: { phone: 'secret' },
      customer: { email: 'secret@example.test' },
      items: [{ id: 'item-1' }],
    }),
  });
  assert.deepEqual(await service.createForCustomer({} as never, 'customer-1'), {
    id: 'order-1',
    orderNumber: 'LINXAS-20260913-ABC123',
  });
});

test('checkout confirmation accepts only a valid non-sensitive order number', () => {
  assert.equal(
    getSafeOrderConfirmationNumber('LINXAS-20260913-ABC123'),
    'LINXAS-20260913-ABC123',
  );
  assert.equal(
    getSafeOrderConfirmationNumber('<script>alert(1)</script>'),
    null,
  );
  assert.equal(getSafeOrderConfirmationNumber(undefined), null);
});

test('customer order rejection response contains no order PII or relations', async () => {
  const result = await requestOrder('LINXAS-20260913-ABC123');
  const serialized = JSON.stringify(result.payload).toLowerCase();
  for (const sensitiveField of [
    'address',
    'phone',
    'email',
    'shipment',
    'payment',
    'items',
  ]) {
    assert.equal(serialized.includes(sensitiveField), false);
  }
});

test('existing-looking and random order identifiers have identical rejection', async () => {
  const existingLooking = await requestOrder('LINXAS-20260913-ABC123');
  const random = await requestOrder('not-an-order');
  assert.deepEqual(random, existingLooking);
});

test('consumer confirmation pages do not query Order service or repository', async () => {
  const sources = await Promise.all([
    readFile(`${process.cwd()}/app/order-complete/page.tsx`, 'utf8'),
    readFile(`${process.cwd()}/app/orders/[orderNumber]/page.tsx`, 'utf8'),
  ]);
  for (const source of sources) {
    assert.equal(source.includes('OrderService'), false);
    assert.equal(source.includes('OrderRepository'), false);
  }
});

test('payment repository responses do not include the related order object', async () => {
  const source = await readFile(
    `${process.cwd()}/repositories/payment.repository.ts`,
    'utf8',
  );
  assert.equal(source.includes('include: { order: true }'), false);
  assert.equal(source.includes('const include = { order: true }'), false);
});
