import {
  EmailTemplate,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ShipmentStatus,
  InventoryReservationStatus,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

const include = {
  items: true,
  customer: true,
  payments: { orderBy: { createdAt: 'desc' } },
  shipments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

const paymentTargetSelect = {
  id: true,
  orderNumber: true,
  totalAmount: true,
  paymentStatus: true,
} satisfies Prisma.OrderSelect;

export const customerOrderSelect = {
  id: true,
  orderNumber: true,
  createdAt: true,
  status: true,
  paymentStatus: true,
  shipmentStatus: true,
  subtotal: true,
  shippingFee: true,
  taxAmount: true,
  discountAmount: true,
  totalAmount: true,
  shippingAddressSnapshot: true,
  items: {
    select: {
      productId: true,
      productName: true,
      productCode: true,
      unitPrice: true,
      quantity: true,
      subtotal: true,
      product: { select: { images: { orderBy: { displayOrder: 'asc' }, take: 1, select: { imageUrl: true, altText: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  },
  shipments: {
    select: {
      status: true,
      carrier: true,
      trackingNumber: true,
      shippedAt: true,
      deliveredAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  contactInquiries: {
    where: { orderId: { not: null } }, take: 1,
    select: { id: true, customerLastReadAt: true, messages: { where: { direction: 'ADMIN' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } } },
  },
} satisfies Prisma.OrderSelect;

export type CustomerOrderRecord = Prisma.OrderGetPayload<{
  select: typeof customerOrderSelect;
}>;

type OrderDatabase = Pick<PrismaClient, '$transaction'> & {
  order: PrismaClient['order'];
};

export class OrderRepository {
  public constructor(private readonly database: OrderDatabase = prisma) {}
  findById(id: string) {
    return this.database.order.findUnique({ where: { id }, include });
  }
  findPaymentTargetById(id: string, customerId?: string) {
    return this.database.order.findUnique({
      where: { id, ...(customerId ? { customerId } : {}) },
      select: paymentTargetSelect,
    });
  }
  findPaymentTargetByOrderNumber(orderNumber: string, customerId?: string) {
    return this.database.order.findUnique({
      where: { orderNumber, ...(customerId ? { customerId } : {}) },
      select: paymentTargetSelect,
    });
  }
  findMany(query: { status?: OrderStatus; keyword?: string }) {
    return this.database.order.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.keyword
          ? { orderNumber: { contains: query.keyword, mode: 'insensitive' } }
          : {}),
      },
      include,
      orderBy: { createdAt: 'desc' },
    });
  }
  create(data: Prisma.OrderCreateInput) {
    return this.database.$transaction((tx) =>
      tx.order.create({ data, include }),
    );
  }
  updateStatus(id: string, status: OrderStatus) {
    return this.database.order.update({
      where: { id },
      data: { status },
      include,
    });
  }
  updateStatusWithReservationTransition(
    id: string,
    status: OrderStatus,
    transition: 'NONE' | 'RELEASE' | 'CONSUME',
    emailTemplate: EmailTemplate | null = null,
  ) {
    return this.database.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: { status },
        include,
      });
      if (transition !== 'NONE') {
        await tx.inventoryReservation.updateMany({
          where: { orderId: id, status: InventoryReservationStatus.ACTIVE },
          data: {
            status:
              transition === 'RELEASE'
                ? InventoryReservationStatus.RELEASED
                : InventoryReservationStatus.CONSUMED,
          },
        });
      }
      if (emailTemplate) {
        await tx.emailOutbox.upsert({
          where: { eventKey: `order:${id}:${status}` },
          update: {},
          create: {
            eventKey: `order:${id}:${status}`,
            type: `ORDER_${status}`,
            recipient: order.customer.email,
            subject: 'ご注文をキャンセルしました',
            template: emailTemplate,
            payload: {
              orderNumber: order.orderNumber,
              totalAmount: Number(order.totalAmount),
            },
          },
        });
      }
      return order;
    });
  }
  updatePaymentStatus(id: string, paymentStatus: PaymentStatus) {
    return this.database.order.update({
      where: { id },
      data: { paymentStatus },
      include,
    });
  }
  updateShipmentStatus(id: string, shipmentStatus: ShipmentStatus) {
    return this.database.order.update({
      where: { id },
      data: { shipmentStatus },
      include,
    });
  }

  findOwnedByOrderNumber(customerId: string, orderNumber: string) {
    return this.database.order.findFirst({
      where: { orderNumber, customerId },
      select: customerOrderSelect,
    });
  }

  async findOwnedPage(customerId: string, page: number, pageSize: number) {
    const where = { customerId };
    const [items, total] = await this.database.$transaction([
      this.database.order.findMany({
        where,
        select: customerOrderSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.order.count({ where }),
    ]);
    return { items, total };
  }
}
