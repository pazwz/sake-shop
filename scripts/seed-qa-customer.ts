import {
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  ShipmentCarrier,
  ShipmentStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { CUSTOMER_PASSWORD_HASH_ROUNDS } from '@/config/customer-auth';
import { assertQaSeedAllowed } from '@/config/qa-seed';

const QA_EMAIL = 'qa-customer@example.test';
const QA_PASSWORD = 'Test-Customer-123!';
const prisma = new PrismaClient();

const run = async () => {
  assertQaSeedAllowed();
  const product = await prisma.product.findFirst({
    where: { isActive: true, isEcAvailable: true, images: { some: {} } },
    orderBy: { id: 'asc' },
  });
  if (!product)
    throw new Error('QA seed requires one existing public product.');
  const passwordHash = await hash(QA_PASSWORD, CUSTOMER_PASSWORD_HASH_ROUNDS);
  const customer = await prisma.customer.upsert({
    where: { email: QA_EMAIL },
    update: { name: 'QA Customer', passwordHash, emailVerifiedAt: new Date() },
    create: {
      email: QA_EMAIL,
      name: 'QA Customer',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  const existingAddress = await prisma.customerAddress.findFirst({
    where: { customerId: customer.id, addressLine1: 'TEST address 1-1' },
  });
  const address = {
    postalCode: '810-0000',
    prefecture: '福岡県',
    city: '福岡市博多区',
    addressLine1: 'TEST address 1-1',
    addressLine2: 'QA / TEST',
    recipientName: 'QA Customer',
    phone: '00000000000',
    isDefault: true,
  };
  if (existingAddress)
    await prisma.customerAddress.update({
      where: { id: existingAddress.id },
      data: address,
    });
  else
    await prisma.customerAddress.create({
      data: { ...address, customerId: customer.id },
    });

  const definitions = [
    {
      orderNumber: 'QA-MYPAGE-PENDING',
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      daysAgo: 2,
    },
    {
      orderNumber: 'QA-MYPAGE-PREPARING',
      status: OrderStatus.PROCESSING,
      paymentStatus: PaymentStatus.SUCCEEDED,
      daysAgo: 8,
    },
    {
      orderNumber: 'QA-MYPAGE-SHIPPED',
      status: OrderStatus.SHIPPED,
      paymentStatus: PaymentStatus.SUCCEEDED,
      daysAgo: 15,
    },
  ];
  for (const definition of definitions) {
    const subtotal = Number(product.price);
    const shippingFee = 880;
    const createdAt = new Date(Date.now() - definition.daysAgo * 86_400_000);
    const order = await prisma.order.upsert({
      where: { orderNumber: definition.orderNumber },
      update: {
        customerId: customer.id,
        status: definition.status,
        paymentStatus: definition.paymentStatus,
        shipmentStatus:
          definition.status === OrderStatus.SHIPPED
            ? ShipmentStatus.SHIPPED
            : ShipmentStatus.PENDING,
      },
      create: {
        orderNumber: definition.orderNumber,
        customerId: customer.id,
        status: definition.status,
        paymentStatus: definition.paymentStatus,
        shipmentStatus:
          definition.status === OrderStatus.SHIPPED
            ? ShipmentStatus.SHIPPED
            : ShipmentStatus.PENDING,
        subtotal,
        shippingFee,
        taxAmount:
          (subtotal * Number(product.taxRate)) /
          (100 + Number(product.taxRate)),
        discountAmount: 0,
        totalAmount: subtotal + shippingFee,
        paymentMethod: 'QA_TEST',
        shippingAddressSnapshot: address,
        shippingQuoteSnapshot: {
          policyVersion: 'qa-fixture-v1',
          baseFee: shippingFee,
          coolFee: 0,
          remoteAreaFee: 0,
          totalShipping: shippingFee,
          method: 'QA_TEST',
          carrier: 'SAGAWA',
        },
        ageConfirmedAt: createdAt,
        orderedAt: createdAt,
        createdAt,
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
    if (definition.status === OrderStatus.SHIPPED) {
      const shipment = await prisma.shipment.findFirst({
        where: { orderId: order.id },
      });
      const data = {
        carrier: ShipmentCarrier.SAGAWA,
        trackingNumber: 'TEST123456789',
        shippingMethod: 'QA_TEST',
        status: ShipmentStatus.SHIPPED,
        shippedAt: createdAt,
      };
      if (shipment)
        await prisma.shipment.update({ where: { id: shipment.id }, data });
      else
        await prisma.shipment.create({ data: { ...data, orderId: order.id } });
    }
  }
  process.stdout.write(`QA customer ready: ${QA_EMAIL}\n`);
};

run().finally(() => prisma.$disconnect());
