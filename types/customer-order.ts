import type {
  OrderStatus,
  PaymentStatus,
  ShipmentStatus,
} from '@prisma/client';

export type CustomerOrderSummary = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shipmentStatus: ShipmentStatus;
  totalAmount: number;
  items: Array<{ productName: string; quantity: number; imageUrl: string | null; imageAlt: string | null }>;
  shipment: { status: ShipmentStatus; carrier: string; trackingNumber: string | null; shippedAt: string | null; deliveredAt: string | null } | null;
  hasUnreadMessage: boolean;
};

export type CustomerOrderDetail = Omit<CustomerOrderSummary, 'items' | 'shipment'> & {
  subtotal: number;
  shippingFee: number;
  taxAmount: number;
  discountAmount: number;
  shippingAddress: {
    postalCode: string;
    prefecture: string;
    city: string;
    addressLine1: string;
    addressLine2: string | null;
    recipientName: string;
    phone: string;
  } | null;
  items: Array<{
    productId: string;
    productName: string;
    productCode: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    imageUrl: string | null;
    imageAlt: string | null;
  }>;
  shipment: {
    status: ShipmentStatus;
    carrier: string;
    trackingNumber: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
};

export type CustomerOrderPage = {
  items: CustomerOrderSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
