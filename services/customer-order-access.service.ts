import { NotFoundError } from '@/lib/errors';
import {
  OrderRepository,
  type CustomerOrderRecord,
} from '@/repositories/order.repository';
import { requireCustomer } from '@/services/customer-authorization.service';
import type {
  CustomerOrderDetail,
  CustomerOrderPage,
  CustomerOrderSummary,
} from '@/types/customer-order';

type CurrentCustomer = { id: string };

const asNumber = (value: { toString(): string } | number) => Number(value);
const addressFrom = (
  value: unknown,
): CustomerOrderDetail['shippingAddress'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const address = value as Record<string, unknown>;
  const required = [
    'postalCode',
    'prefecture',
    'city',
    'addressLine1',
    'recipientName',
    'phone',
  ] as const;
  if (!required.every((field) => typeof address[field] === 'string'))
    return null;
  return {
    postalCode: address.postalCode as string,
    prefecture: address.prefecture as string,
    city: address.city as string,
    addressLine1: address.addressLine1 as string,
    addressLine2:
      typeof address.addressLine2 === 'string' ? address.addressLine2 : null,
    recipientName: address.recipientName as string,
    phone: address.phone as string,
  };
};

export class CustomerOrderAccessService {
  public constructor(
    private readonly orders = new OrderRepository(),
    private readonly currentCustomer: () => Promise<CurrentCustomer> = requireCustomer,
  ) {}

  private summary(order: CustomerOrderRecord): CustomerOrderSummary {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      shipmentStatus: order.shipmentStatus,
      totalAmount: asNumber(order.totalAmount),
      items: order.items.map((item) => ({ productName: item.productName, quantity: item.quantity, imageUrl: item.product?.images[0]?.imageUrl ?? null, imageAlt: item.product?.images[0]?.altText ?? null })),
      shipment: order.shipments[0] ? { ...order.shipments[0], shippedAt: order.shipments[0].shippedAt?.toISOString() ?? null, deliveredAt: order.shipments[0].deliveredAt?.toISOString() ?? null } : null,
      hasUnreadMessage: (() => { const thread = order.contactInquiries[0]; const last = thread?.messages[0]?.createdAt; return !!last && (!thread.customerLastReadAt || last > thread.customerLastReadAt); })(),
    };
  }

  public async getOrderDetail(
    orderNumber: string,
  ): Promise<CustomerOrderDetail> {
    const customer = await this.currentCustomer();
    const order = await this.orders.findOwnedByOrderNumber(
      customer.id,
      orderNumber,
    );
    if (!order) throw new NotFoundError('Order was not found.');
    return {
      ...this.summary(order),
      subtotal: asNumber(order.subtotal),
      shippingFee: asNumber(order.shippingFee),
      taxAmount: asNumber(order.taxAmount),
      discountAmount: asNumber(order.discountAmount),
      shippingAddress: addressFrom(order.shippingAddressSnapshot),
      items: order.items.map((item) => ({
        productId: item.productId, productName: item.productName, productCode: item.productCode,
        unitPrice: asNumber(item.unitPrice),
        subtotal: asNumber(item.subtotal),
        quantity: item.quantity,
        imageUrl: item.product?.images[0]?.imageUrl ?? null,
        imageAlt: item.product?.images[0]?.altText ?? null,
      })),
    };
  }

  public async getOrderPage(
    page: number,
    pageSize = 10,
  ): Promise<CustomerOrderPage> {
    const customer = await this.currentCustomer();
    const safePage = Math.max(1, Math.trunc(page));
    const result = await this.orders.findOwnedPage(
      customer.id,
      safePage,
      pageSize,
    );
    return {
      items: result.items.map((order) => this.summary(order)),
      page: safePage,
      pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    };
  }
}
