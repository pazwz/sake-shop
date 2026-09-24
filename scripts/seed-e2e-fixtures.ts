import {
  AdminRole,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  ShipmentStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { CUSTOMER_PASSWORD_HASH_ROUNDS } from '@/config/customer-auth';
import { E2E_FIXTURES } from '@/config/e2e-fixtures';
import { assertQaSeedAllowed } from '@/config/qa-seed';

const prisma = new PrismaClient();

const run = async () => {
  assertQaSeedAllowed();
  const product = await prisma.product.findFirst({
    where: { isActive: true, isEcAvailable: true, images: { some: {} } },
    orderBy: { id: 'asc' },
  });
  if (!product) throw new Error('E2E_FIXTURE_REQUIRES_PUBLIC_PRODUCT');

  const [customerPasswordHash, secondaryPasswordHash, staffPasswordHash] =
    await Promise.all([
      hash(E2E_FIXTURES.customer.password, CUSTOMER_PASSWORD_HASH_ROUNDS),
      hash(
        E2E_FIXTURES.secondaryCustomer.password,
        CUSTOMER_PASSWORD_HASH_ROUNDS,
      ),
      hash(E2E_FIXTURES.staff.password, CUSTOMER_PASSWORD_HASH_ROUNDS),
    ]);
  const customer = await prisma.customer.upsert({
    where: { email: E2E_FIXTURES.customer.email },
    update: {
      name: 'E2E Customer',
      passwordHash: customerPasswordHash,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: E2E_FIXTURES.customer.email,
      name: 'E2E Customer',
      passwordHash: customerPasswordHash,
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.customer.upsert({
    where: { email: E2E_FIXTURES.secondaryCustomer.email },
    update: {
      name: 'E2E Secondary Customer',
      passwordHash: secondaryPasswordHash,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: E2E_FIXTURES.secondaryCustomer.email,
      name: 'E2E Secondary Customer',
      passwordHash: secondaryPasswordHash,
      emailVerifiedAt: new Date(),
    },
  });
  await prisma.adminUser.upsert({
    where: { username: E2E_FIXTURES.staff.username },
    update: {
      email: 'e2e-staff@example.test',
      name: 'E2E Staff',
      role: AdminRole.STAFF,
      isActive: true,
      passwordHash: staffPasswordHash,
    },
    create: {
      username: E2E_FIXTURES.staff.username,
      email: 'e2e-staff@example.test',
      name: 'E2E Staff',
      role: AdminRole.STAFF,
      isActive: true,
      passwordHash: staffPasswordHash,
    },
  });

  const subtotal = Number(product.price);
  const shippingFee = 880;
  await prisma.order.upsert({
    where: { orderNumber: E2E_FIXTURES.orderNumber },
    update: {
      customerId: customer.id,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      shipmentStatus: ShipmentStatus.PENDING,
    },
    create: {
      orderNumber: E2E_FIXTURES.orderNumber,
      customerId: customer.id,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      shipmentStatus: ShipmentStatus.PENDING,
      subtotal,
      shippingFee,
      taxAmount:
        (subtotal * Number(product.taxRate)) / (100 + Number(product.taxRate)),
      discountAmount: 0,
      totalAmount: subtotal + shippingFee,
      paymentMethod: 'E2E_TEST',
      shippingAddressSnapshot: {
        prefecture: '福岡県',
        city: '福岡市',
        addressLine1: 'E2E test address',
      },
      shippingQuoteSnapshot: {
        policyVersion: 'e2e',
        totalShipping: shippingFee,
        method: 'E2E_TEST',
      },
      ageConfirmedAt: new Date(),
      items: {
        create: {
          productId: product.id,
          productName: product.name,
          productCode: product.productCode,
          unitPrice: product.price,
          quantity: 1,
          taxRate: product.taxRate,
          subtotal,
          requiresTransfer: false,
        },
      },
    },
  });
};

run().finally(() => prisma.$disconnect());
