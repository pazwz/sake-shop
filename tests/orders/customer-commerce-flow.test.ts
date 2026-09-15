import assert from 'node:assert/strict';
import test from 'node:test';
import { PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { AppError } from '@/lib/errors';
import { hashCustomerSessionToken } from '@/lib/customer-session';
import { CustomerAuthService } from '@/services/customer-auth.service';
import { CustomerOrderAccessService } from '@/services/customer-order-access.service';
import { InventoryReservationService } from '@/services/inventory-reservation.service';
import { OrderService } from '@/services/order.service';
import { PaymentService } from '@/services/payment.service';
import type { OrderInput } from '@/validators/order.validator';

test('customer commerce integration: auth, checkout ownership, history and failed-payment release', async () => {
  const customers = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      phone: null;
      passwordHash: string;
      emailVerifiedAt: Date;
    }
  >();
  const sessions = new Map<string, string>();
  const authRepository = {
    registerPendingVerification: async (input: {
      name: string;
      email: string;
      passwordHash: string;
    }) => {
      const customer = {
        id: `customer-${customers.size + 1}`,
        name: input.name,
        email: input.email,
        phone: null,
        passwordHash: input.passwordHash,
        emailVerifiedAt: new Date(),
      };
      customers.set(input.email, customer);
      const { passwordHash: _passwordHash, ...result } = customer;
      return result;
    },
    findAuthenticationByEmail: async (email: string) =>
      customers.get(email) ?? null,
    rotateSession: async (customerId: string, tokenHash: string) => {
      sessions.set(tokenHash, customerId);
      return { id: 'session-login' };
    },
    findCustomerBySessionHash: async (tokenHash: string) => {
      const customerId = sessions.get(tokenHash);
      const customer = [...customers.values()].find(
        ({ id }) => id === customerId,
      );
      if (!customer) return null;
      const { passwordHash: _passwordHash, ...publicCustomer } = customer;
      return { customer: publicCustomer };
    },
  };
  const auth = new CustomerAuthService(authRepository as never);
  await auth.register({
    name: 'Buyer A',
    email: 'buyer-a@example.com',
    password: 'long-password-a',
  });
  const loggedIn = await auth.login({
    email: 'buyer-a@example.com',
    password: 'long-password-a',
  });
  const current = await auth.getCustomer(loggedIn.token);
  assert.equal(current?.id, 'customer-1');

  const cart = [{ productId: 'cm1234567890abcdefghijklmnop', quantity: 1 }];
  let reservationStatus: 'ACTIVE' | 'RELEASED' = 'ACTIVE';
  const persistedOrders: Array<Record<string, unknown>> = [];
  const reservationRepository = {
    withLockedProducts: async (
      _ids: string[],
      operation: (tx: unknown) => Promise<unknown>,
    ) =>
      operation({
        findProducts: async () => [
          {
            id: cart[0].productId,
            smaregiProductId: '8000001',
            productCode: '4900000000001',
            name: 'Test bottle',
            price: new Prisma.Decimal(1000),
            taxRate: new Prisma.Decimal(10),
            isActive: true,
            isEcAvailable: true,
            boxProductId: null,
            category: { smaregiCategoryId: '8000001' },
            inventoryMirrors: [{ smaregiStoreId: '1', quantity: 2 }],
          },
        ],
        getActiveReservedQuantities: async () => new Map(),
        createOrderWithReservations: async (order: Record<string, unknown>) => {
          persistedOrders.push(order);
          return order;
        },
      }),
  };
  const orderInput: OrderInput = {
    items: cart,
    address: {
      postalCode: '810-0001',
      prefecture: '福岡県',
      city: '福岡市',
      addressLine1: '1-1',
      recipientName: 'Buyer A',
      phone: '09000000000',
    },
    ageConfirmed: true,
    paymentMethod: 'card',
  };
  const created = await new OrderService(
    {} as never,
    reservationRepository as never,
  ).createForCustomer(orderInput, current!.id);
  const persistedOrder = persistedOrders[0];
  assert.equal(persistedOrder.customerId, current!.id);
  assert.deepEqual(persistedOrder.shippingQuoteSnapshot, {
    baseFee: 880,
    coolFee: 0,
    remoteAreaFee: 0,
    totalShipping: 880,
    method: 'development-standard',
    carrier: 'SAGAWA',
    calculationBreakdown: {
      policyVersion: 'development-placeholder-v1',
      baseFee: 880,
      coolFee: 0,
      remoteAreaFee: 0,
      note: '正式な佐川急便送料表の承認前に使用する開発用暫定見積もり',
    },
  });
  assert.equal(
    (persistedOrder.items as Array<{ expiresAt: Date }>)[0].expiresAt instanceof
      Date,
    true,
  );

  const orderRecord = {
    orderNumber: created.orderNumber,
    createdAt: new Date(),
    status: 'PENDING',
    paymentStatus: 'PENDING',
    subtotal: 1000,
    shippingFee: 0,
    taxAmount: 91,
    discountAmount: 0,
    totalAmount: 1000,
    shippingAddressSnapshot: orderInput.address,
    items: [
      {
        productId: cart[0].productId,
        productName: 'Test bottle',
        productCode: '4900000000001',
        unitPrice: 1000,
        quantity: 1,
        subtotal: 1000,
      },
    ],
    shipments: [],
  };
  const ownedOrders = new CustomerOrderAccessService(
    {
      findOwnedPage: async (customerId: string) => ({
        items: customerId === current!.id ? [orderRecord] : [],
        total: customerId === current!.id ? 1 : 0,
      }),
      findOwnedByOrderNumber: async (
        customerId: string,
        orderNumber: string,
      ) =>
        customerId === current!.id && orderNumber === created.orderNumber
          ? orderRecord
          : null,
    } as never,
    async () => current!,
  );
  assert.equal((await ownedOrders.getOrderPage(1)).total, 1);
  assert.equal(
    (await ownedOrders.getOrderDetail(created.orderNumber)).orderNumber,
    created.orderNumber,
  );

  const reservationLifecycle = new InventoryReservationService({
    releaseForOrder: async () => {
      if (reservationStatus !== 'ACTIVE') return { count: 0 };
      reservationStatus = 'RELEASED';
      return { count: 1 };
    },
  } as never);
  const payment = {
    id: 'payment-1',
    orderId: persistedOrder.id,
    amount: 1000,
    status: PaymentStatus.PENDING,
  };
  await new PaymentService({
    findByProviderPaymentId: async () => payment,
    findWebhookEvent: async () => null,
    processWebhook: async (input: { reservationTransition: string }) => {
      assert.equal(input.reservationTransition, 'RELEASE');
      await reservationLifecycle.releaseForOrder(String(payment.orderId));
      return {
        payment: { ...payment, status: PaymentStatus.FAILED },
        duplicate: false,
      };
    },
  } as never).handleWebhook(
    {
      provider: PaymentProvider.STERA,
      providerPaymentId: 'mock-stera-payment',
      eventId: 'failed-event',
      status: PaymentStatus.FAILED,
    },
    'mock-development-signature',
  );
  assert.equal(reservationStatus, 'RELEASED');

  await auth.register({
    name: 'Buyer B',
    email: 'buyer-b@example.com',
    password: 'long-password-b',
  });
  const buyerBLogin = await auth.login({
    email: 'buyer-b@example.com',
    password: 'long-password-b',
  });
  const currentB = await auth.getCustomer(buyerBLogin.token);
  const otherCustomer = new CustomerOrderAccessService(
    { findOwnedByOrderNumber: async () => null } as never,
    async () => currentB!,
  );
  await assert.rejects(
    () => otherCustomer.getOrderDetail(created.orderNumber),
    (error: unknown) => error instanceof AppError && error.statusCode === 404,
  );
  assert.equal(sessions.has(hashCustomerSessionToken(loggedIn.token)), true);
});
