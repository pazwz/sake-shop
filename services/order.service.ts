import { randomUUID } from 'crypto';
import { OrderStatus } from '@prisma/client';
import { DEVELOPMENT_DISCOUNT_AMOUNT } from '@/config/order';
import { getTemporaryShippingQuote } from '@/config/shipping';
import { AppError, NotFoundError } from '@/lib/errors';
import { CustomerRepository } from '@/repositories/customer.repository';
import { OrderRepository } from '@/repositories/order.repository';
import { ProductRepository } from '@/repositories/product.repository';
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
    private readonly products = new ProductRepository(),
    private readonly customers = new CustomerRepository(),
  ) {}
  async create(input: OrderInput) {
    const products = await this.products.findForOrder(
      input.items.map((item) => item.productId),
    );
    if (products.length !== input.items.length)
      throw new AppError(
        'One or more products could not be found.',
        'PRODUCT_NOT_FOUND',
        404,
      );
    const lines = input.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId)!;
      if (!product.isActive || !product.isEcAvailable)
        throw new AppError(
          'This product is not available for online purchase.',
          'PRODUCT_NOT_AVAILABLE',
          409,
        );
      const available = product.inventoryMirrors.reduce(
        (sum, inventory) => sum + inventory.availableQuantity,
        0,
      );
      if (available < item.quantity)
        throw new AppError(
          'The requested quantity is not available.',
          'INSUFFICIENT_INVENTORY',
          409,
        );
      const unitPrice = Number(product.price);
      const subtotal = unitPrice * item.quantity;
      return {
        product,
        item,
        unitPrice,
        subtotal,
        tax:
          (subtotal * Number(product.taxRate)) /
          (100 + Number(product.taxRate)),
      };
    });
    const customer = await this.customers.upsertForOrder(input.customer);
    const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
    const taxAmount = lines.reduce((sum, line) => sum + line.tax, 0);
    const shippingFee = getTemporaryShippingQuote().fee;
    const discountAmount = DEVELOPMENT_DISCOUNT_AMOUNT;
    return this.orders.create({
      orderNumber: `KURA-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`,
      customer: { connect: { id: customer.id } },
      subtotal,
      shippingFee,
      taxAmount,
      discountAmount,
      totalAmount: subtotal + shippingFee - discountAmount,
      paymentMethod: input.paymentMethod,
      shippingAddressSnapshot: input.address,
      ageConfirmedAt: new Date(),
      items: {
        create: lines.map(
          ({ product, item, unitPrice, subtotal: lineSubtotal }) => ({
            productId: product.id,
            productName: product.name,
            productCode: product.productCode,
            unitPrice,
            quantity: item.quantity,
            taxRate: product.taxRate,
            subtotal: lineSubtotal,
          }),
        ),
      },
    });
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
