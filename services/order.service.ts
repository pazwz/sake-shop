import { randomUUID } from 'crypto';
import { OrderStatus } from '@prisma/client';
import { DEVELOPMENT_DISCOUNT_AMOUNT } from '@/config/order';
import { getTemporaryShippingQuote } from '@/config/shipping';
import { AppError, NotFoundError } from '@/lib/errors';
import { InventoryReservationRepository } from '@/repositories/inventory-reservation.repository';
import { OrderRepository } from '@/repositories/order.repository';
import {
  projectApprovedInventory,
  requiresTransferForQuantity,
} from '@/services/inventory-projection.service';
import type { OrderInput } from '@/validators/order.validator';

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PAID: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.READY_TO_SHIP, OrderStatus.CANCELLED],
  READY_TO_SHIP: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};
export class OrderService {
  constructor(
    private readonly orders = new OrderRepository(),
    private readonly reservations = new InventoryReservationRepository(),
  ) {}
  async create(input: OrderInput) {
    const requestedProductIds = input.items.map((item) => item.productId);
    if (new Set(requestedProductIds).size !== requestedProductIds.length)
      throw new AppError(
        'Each product may appear only once in an order.',
        'DUPLICATE_ORDER_PRODUCT',
        422,
      );
    const sortedProductIds = [...requestedProductIds].sort();
    return this.reservations.withLockedProducts(
      sortedProductIds,
      async (transaction) => {
        const products = await transaction.findProducts(sortedProductIds);
        if (products.length !== sortedProductIds.length)
          throw new AppError(
            'One or more products could not be found.',
            'PRODUCT_NOT_FOUND',
            404,
          );
        const activeReservations =
          await transaction.getActiveReservedQuantities(sortedProductIds);
        const productById = new Map(
          products.map((product) => [product.id, product]),
        );
        const lines = input.items.map((item) => {
          const product = productById.get(item.productId)!;
          if (!product.isActive || !product.isEcAvailable)
            throw new AppError(
              'This product is not available for online purchase.',
              'PRODUCT_NOT_AVAILABLE',
              409,
            );
          const projection = projectApprovedInventory(
            product.inventoryMirrors,
            activeReservations.get(product.id) ?? 0,
          );
          const requiresTransfer = requiresTransferForQuantity(
            projection,
            item.quantity,
          );
          const unitPrice = Number(product.price);
          const subtotal = unitPrice * item.quantity;
          return {
            product,
            item,
            unitPrice,
            subtotal,
            requiresTransfer,
            tax:
              (subtotal * Number(product.taxRate)) /
              (100 + Number(product.taxRate)),
          };
        });
        const customer = await transaction.upsertCustomer(input.customer);
        const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
        const taxAmount = lines.reduce((sum, line) => sum + line.tax, 0);
        const shippingFee = getTemporaryShippingQuote().fee;
        const discountAmount = DEVELOPMENT_DISCOUNT_AMOUNT;
        const orderId = randomUUID();
        const now = new Date();
        return transaction.createOrderWithReservations({
          id: orderId,
          orderNumber: `LINXAS-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`,
          customerId: customer.id,
          subtotal,
          shippingFee,
          taxAmount,
          discountAmount,
          totalAmount: subtotal + shippingFee - discountAmount,
          paymentMethod: input.paymentMethod,
          shippingAddressSnapshot: {
            ...input.address,
            addressLine2: input.address.addressLine2 ?? null,
          },
          ageConfirmedAt: now,
          items: lines.map(
            ({
              product,
              item,
              unitPrice,
              subtotal: lineSubtotal,
              requiresTransfer,
            }) => ({
              id: randomUUID(),
              reservationId: randomUUID(),
              productId: product.id,
              productName: product.name,
              productCode: product.productCode,
              unitPrice,
              quantity: item.quantity,
              taxRate: product.taxRate,
              subtotal: lineSubtotal,
              requiresTransfer,
              expiresAt: null,
            }),
          ),
        });
      },
    );
  }
  async getByOrderNumber(orderNumber: string) {
    const order = await this.orders.findByOrderNumber(orderNumber);
    if (!order) throw new NotFoundError('ORDER_NOT_FOUND');
    return order;
  }
  async getAdminOrders(query: { status?: OrderStatus; keyword?: string }) {
    return this.orders.findMany(query);
  }
  async getAdminOrder(id: string) {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundError('ORDER_NOT_FOUND');
    return order;
  }
  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.getAdminOrder(id);
    if (!transitions[order.status].includes(status))
      throw new AppError(
        'The requested order status transition is not allowed.',
        'INVALID_ORDER_STATUS_TRANSITION',
        422,
      );
    return this.orders.updateStatus(id, status);
  }
}
