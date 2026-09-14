import {
  InventoryReservationStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

const productInclude = {
  category: true,
  inventoryMirrors: {
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ProductInclude;

const orderInclude = {
  items: true,
  customer: true,
  payments: { orderBy: { createdAt: 'desc' } },
  shipments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

export type ReservationProduct = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

export type ReservedOrderInput = {
  id: string;
  orderNumber: string;
  customerId: string;
  subtotal: number;
  shippingFee: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  shippingAddressSnapshot: Prisma.InputJsonValue;
  shippingQuoteSnapshot: Prisma.InputJsonValue;
  ageConfirmedAt: Date;
  items: Array<{
    id: string;
    reservationId: string;
    productId: string;
    productName: string;
    productCode: string;
    unitPrice: number;
    quantity: number;
    taxRate: Prisma.Decimal;
    subtotal: number;
    requiresTransfer: boolean;
    parentOrderItemId: string | null;
    expiresAt: Date | null;
  }>;
};

export interface LockedInventoryReservationTransaction {
  findProducts(productIds: string[]): Promise<ReservationProduct[]>;
  getActiveReservedQuantities(
    productIds: string[],
  ): Promise<Map<string, number>>;
  createOrderWithReservations(
    input: ReservedOrderInput,
  ): Promise<Prisma.OrderGetPayload<{ include: typeof orderInclude }>>;
}

type TransactionDatabase = Pick<PrismaClient, '$transaction'> & {
  inventoryReservation: Pick<
    PrismaClient['inventoryReservation'],
    'groupBy' | 'updateMany'
  >;
};

const TRANSACTION_MAX_WAIT_MS = 10_000;
const TRANSACTION_TIMEOUT_MS = 30_000;

class PrismaLockedInventoryReservationTransaction
  implements LockedInventoryReservationTransaction
{
  public constructor(private readonly transaction: Prisma.TransactionClient) {}

  public findProducts(productIds: string[]) {
    return this.transaction.product.findMany({
      where: { id: { in: productIds } },
      include: productInclude,
    });
  }

  public async getActiveReservedQuantities(productIds: string[]) {
    const rows = await this.transaction.inventoryReservation.groupBy({
      by: ['productId'],
      where: {
        productId: { in: productIds },
        status: InventoryReservationStatus.ACTIVE,
      },
      _sum: { quantity: true },
    });
    return new Map(rows.map((row) => [row.productId, row._sum.quantity ?? 0]));
  }

  public async createOrderWithReservations(input: ReservedOrderInput) {
    const order = await this.transaction.order.create({
      data: {
        id: input.id,
        orderNumber: input.orderNumber,
        customer: { connect: { id: input.customerId } },
        subtotal: input.subtotal,
        shippingFee: input.shippingFee,
        taxAmount: input.taxAmount,
        discountAmount: input.discountAmount,
        totalAmount: input.totalAmount,
        paymentMethod: input.paymentMethod,
        shippingAddressSnapshot: input.shippingAddressSnapshot,
        shippingQuoteSnapshot: input.shippingQuoteSnapshot,
        ageConfirmedAt: input.ageConfirmedAt,
        items: {
          create: input.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            taxRate: item.taxRate,
            subtotal: item.subtotal,
            requiresTransfer: item.requiresTransfer,
            parentOrderItemId: item.parentOrderItemId,
          })),
        },
      },
      include: orderInclude,
    });
    await this.transaction.inventoryReservation.createMany({
      data: input.items.map((item) => ({
        id: item.reservationId,
        productId: item.productId,
        orderId: input.id,
        orderItemId: item.id,
        quantity: item.quantity,
        status: InventoryReservationStatus.ACTIVE,
        expiresAt: item.expiresAt,
      })),
    });
    await this.transaction.emailOutbox.create({
      data: {
        eventKey: `order-received:${order.id}`,
        type: 'ORDER_CREATED',
        recipient: order.customer.email,
        subject: 'ご注文を承りました',
        template: 'ORDER_RECEIVED',
        payload: {
          orderNumber: order.orderNumber,
          orderedAt: order.orderedAt.toISOString(),
          items: order.items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
          })),
          subtotal: Number(order.subtotal),
          shipping: Number(order.shippingFee),
          totalAmount: Number(order.totalAmount),
          shippingAddress: input.shippingAddressSnapshot,
          status: order.status,
        },
      },
    });
    return order;
  }
}

export class InventoryReservationRepository {
  public constructor(private readonly database: TransactionDatabase = prisma) {}

  public withLockedProducts<T>(
    productIds: string[],
    operation: (
      transaction: LockedInventoryReservationTransaction,
    ) => Promise<T>,
  ) {
    const sortedProductIds = [...new Set(productIds)].sort();
    return this.database.$transaction(
      async (transaction) => {
        for (const productId of sortedProductIds) {
          await transaction.$queryRaw(
            Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${productId} FOR UPDATE`,
          );
        }
        return operation(
          new PrismaLockedInventoryReservationTransaction(transaction),
        );
      },
      {
        maxWait: TRANSACTION_MAX_WAIT_MS,
        timeout: TRANSACTION_TIMEOUT_MS,
      },
    );
  }

  public async getActiveReservedQuantities(productIds: string[]) {
    if (productIds.length === 0) return new Map<string, number>();
    const rows = await this.database.inventoryReservation.groupBy({
      by: ['productId'],
      where: {
        productId: { in: [...new Set(productIds)] },
        status: InventoryReservationStatus.ACTIVE,
      },
      _sum: { quantity: true },
    });
    return new Map(rows.map((row) => [row.productId, row._sum.quantity ?? 0]));
  }

  public releaseForOrder(orderId: string) {
    return this.transitionActiveForOrder(
      orderId,
      InventoryReservationStatus.RELEASED,
    );
  }

  public consumeForOrder(orderId: string) {
    return this.transitionActiveForOrder(
      orderId,
      InventoryReservationStatus.CONSUMED,
    );
  }

  public holdForOrder(orderId: string) {
    return this.database.inventoryReservation.updateMany({
      where: { orderId, status: InventoryReservationStatus.ACTIVE },
      data: { expiresAt: null },
    });
  }

  public expireDue(now = new Date()) {
    return this.database.inventoryReservation.updateMany({
      where: {
        status: InventoryReservationStatus.ACTIVE,
        expiresAt: { not: null, lt: now },
      },
      data: { status: InventoryReservationStatus.EXPIRED },
    });
  }

  private transitionActiveForOrder(
    orderId: string,
    status:
      | typeof InventoryReservationStatus.RELEASED
      | typeof InventoryReservationStatus.CONSUMED,
  ) {
    return this.database.inventoryReservation.updateMany({
      where: { orderId, status: InventoryReservationStatus.ACTIVE },
      data: { status },
    });
  }
}
