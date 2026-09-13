import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ShipmentStatus,
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

export class OrderRepository {
  findById(id: string) {
    return prisma.order.findUnique({ where: { id }, include });
  }
  findPaymentTargetById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      select: paymentTargetSelect,
    });
  }
  findPaymentTargetByOrderNumber(orderNumber: string) {
    return prisma.order.findUnique({
      where: { orderNumber },
      select: paymentTargetSelect,
    });
  }
  findMany(query: { status?: OrderStatus; keyword?: string }) {
    return prisma.order.findMany({
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
    return prisma.$transaction((tx) => tx.order.create({ data, include }));
  }
  updateStatus(id: string, status: OrderStatus) {
    return prisma.order.update({ where: { id }, data: { status }, include });
  }
  updatePaymentStatus(id: string, paymentStatus: PaymentStatus) {
    return prisma.order.update({
      where: { id },
      data: { paymentStatus },
      include,
    });
  }
  updateShipmentStatus(id: string, shipmentStatus: ShipmentStatus) {
    return prisma.order.update({
      where: { id },
      data: { shipmentStatus },
      include,
    });
  }
}
