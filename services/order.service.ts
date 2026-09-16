import { randomUUID } from 'crypto';
import { EmailTemplate, OrderStatus } from '@prisma/client';
import { DEVELOPMENT_DISCOUNT_AMOUNT } from '@/config/order';
import { getReservationExpiry } from '@/config/reservation';
import { AppError, NotFoundError } from '@/lib/errors';
import { InventoryReservationRepository } from '@/repositories/inventory-reservation.repository';
import { OrderRepository } from '@/repositories/order.repository';
import { CheckoutAccessService } from '@/services/checkout-access.service';
import { ShippingQuoteService } from '@/services/shipping-quote.service';
import {
  projectApprovedInventory,
  requiresTransferForQuantity,
} from '@/services/inventory-projection.service';
import {
  isPackageOnlyProduct,
  isStandaloneEcProduct,
} from '@/services/product-visibility.service';
import type { CustomerOrderCreationResult } from '@/types/order';
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
    private readonly checkoutAccess = new CheckoutAccessService(),
    private readonly shippingQuotes = new ShippingQuoteService(),
  ) {}
  async create(input: OrderInput, customerId: string) {
    this.checkoutAccess.assertOrderCreationAllowed();
    const baseProductIds = input.items.map((item) => item.productId);
    if (new Set(baseProductIds).size !== baseProductIds.length)
      throw new AppError(
        'Each product may appear only once in an order.',
        'DUPLICATE_ORDER_PRODUCT',
        422,
      );
    const sortedProductIds = [
      ...new Set(
        input.items.flatMap((item) => [
          item.productId,
          ...(item.boxProductId ? [item.boxProductId] : []),
        ]),
      ),
    ].sort();
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
        const lines = input.items.flatMap((item) => {
          const product = productById.get(item.productId)!;
          if (
            !product.isActive ||
            !product.isEcAvailable ||
            product.isManuallyHidden ||
            !isStandaloneEcProduct(product)
          )
            throw new AppError(
              'This product is not available for online purchase.',
              'PRODUCT_NOT_AVAILABLE',
              409,
            );
          const baseOrderItemId = randomUUID();
          const createLine = (
            lineProduct: typeof product,
            parentOrderItemId: string | null,
          ) => {
            const projection = projectApprovedInventory(
              lineProduct.inventoryMirrors,
              activeReservations.get(lineProduct.id) ?? 0,
            );
            const requiresTransfer = requiresTransferForQuantity(
              projection,
              item.quantity,
            );
            const unitPrice = Number(lineProduct.price);
            const subtotal = unitPrice * item.quantity;
            return {
              id: parentOrderItemId ? randomUUID() : baseOrderItemId,
              reservationId: randomUUID(),
              product: lineProduct,
              quantity: item.quantity,
              unitPrice,
              subtotal,
              requiresTransfer,
              parentOrderItemId,
              tax:
                (subtotal * Number(lineProduct.taxRate)) /
                (100 + Number(lineProduct.taxRate)),
            };
          };
          const baseLine = createLine(product, null);
          if (!item.boxProductId) return [baseLine];
          if (product.boxProductId !== item.boxProductId)
            throw new AppError(
              'The selected box is not linked to this product.',
              'INVALID_BOX_OPTION',
              422,
            );
          const boxProduct = productById.get(item.boxProductId);
          if (
            !boxProduct ||
            !isPackageOnlyProduct(boxProduct) ||
            !boxProduct.isActive ||
            Number(boxProduct.price) <= 0 ||
            Number(boxProduct.taxRate) < 0
          )
            throw new AppError(
              'The selected box is not currently available.',
              'BOX_OPTION_NOT_AVAILABLE',
              409,
            );
          return [baseLine, createLine(boxProduct, baseOrderItemId)];
        });
        const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
        const taxAmount = lines.reduce((sum, line) => sum + line.tax, 0);
        const shippingQuote = this.shippingQuotes.quote({
          prefecture: input.address.prefecture,
          items: input.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            packageType: item.boxProductId ? 'BOXED_BOTTLE' : 'BOTTLE',
            requiresCoolDelivery: false,
          })),
          quantity: input.items.reduce((sum, item) => sum + item.quantity, 0),
          packageType: input.items.some((item) => item.boxProductId)
            ? 'BOXED_BOTTLE'
            : 'BOTTLE',
          requiresCoolDelivery: false,
          subtotal,
        });
        const shippingFee = shippingQuote.totalShipping;
        const discountAmount = DEVELOPMENT_DISCOUNT_AMOUNT;
        const orderId = randomUUID();
        const now = new Date();
        return transaction.createOrderWithReservations({
          id: orderId,
          orderNumber: `LINXAS-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`,
          customerId,
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
          shippingQuoteSnapshot: shippingQuote,
          ageConfirmedAt: now,
          items: lines.map(
            ({
              id,
              reservationId,
              product,
              quantity,
              unitPrice,
              subtotal: lineSubtotal,
              requiresTransfer,
              parentOrderItemId,
            }) => ({
              id,
              reservationId,
              productId: product.id,
              productName: product.name,
              productCode: product.productCode,
              unitPrice,
              quantity,
              taxRate: product.taxRate,
              subtotal: lineSubtotal,
              requiresTransfer,
              parentOrderItemId,
              expiresAt: getReservationExpiry(now),
            }),
          ),
        });
      },
    );
  }
  async createForCustomer(
    input: OrderInput,
    customerId: string,
  ): Promise<CustomerOrderCreationResult> {
    const order = await this.create(input, customerId);
    return { id: order.id, orderNumber: order.orderNumber };
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
    if (order.status === status) return order;
    if (!transitions[order.status].includes(status))
      throw new AppError(
        'The requested order status transition is not allowed.',
        'INVALID_ORDER_STATUS_TRANSITION',
        422,
      );
    return this.orders.updateStatusWithReservationTransition(
      id,
      status,
      status === OrderStatus.CANCELLED
        ? 'RELEASE'
        : status === OrderStatus.COMPLETED
          ? 'CONSUME'
          : 'NONE',
      status === OrderStatus.CANCELLED ? EmailTemplate.ORDER_CANCELLED : null,
    );
  }
}
