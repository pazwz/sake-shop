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
  shipments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;
export class OrderRepository {
  findById(id: string) {
    return prisma.order.findUnique({ where: { id }, include });
  }
  findByOrderNumber(orderNumber: string) {
    return prisma.order.findUnique({ where: { orderNumber }, include });
  }
  findByCustomer(customerId: string) {
    return prisma.order.findMany({
      where: { customerId },
      include,
      orderBy: { createdAt: 'desc' },
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
