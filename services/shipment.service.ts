import { OrderStatus, ShipmentStatus } from '@prisma/client';
import {
  DEFAULT_SHIPMENT_CARRIER,
  DEVELOPMENT_SHIPPING_METHOD,
} from '@/config/shipping';
import { AppError } from '@/lib/errors';
import { OrderRepository } from '@/repositories/order.repository';
import { ShipmentRepository } from '@/repositories/shipment.repository';
import type { ShipmentUpdateInput } from '@/validators/shipment.validator';

const transitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: [ShipmentStatus.PREPARING, ShipmentStatus.CANCELLED],
  PREPARING: [ShipmentStatus.SHIPPED, ShipmentStatus.CANCELLED],
  SHIPPED: [ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

type AuditActor = { adminUserId: string };

export class ShipmentService {
  constructor(
    private readonly shipments = new ShipmentRepository(),
    private readonly orders = new OrderRepository(),
  ) {}

  async getByOrderId(orderId: string) {
    return this.shipments.findByOrderId(orderId);
  }

  async updateForOrder(
    orderId: string,
    input: ShipmentUpdateInput,
    actor: AuditActor,
  ) {
    const order = await this.orders.findById(orderId);
    if (!order)
      throw new AppError('Order was not found.', 'ORDER_NOT_FOUND', 404);

    let shipment = await this.shipments.findByOrderId(orderId);
    if (!shipment) {
      if (order.status !== OrderStatus.READY_TO_SHIP) {
        throw new AppError(
          'The order is not ready to ship.',
          'ORDER_NOT_READY_TO_SHIP',
          409,
        );
      }
      shipment = await this.shipments.create(
        {
          orderId,
          carrier: input.carrier ?? DEFAULT_SHIPMENT_CARRIER,
          shippingMethod: DEVELOPMENT_SHIPPING_METHOD,
        },
        {
          ...actor,
          action: 'SHIPMENT_CREATED',
          entityId: orderId,
          afterData: {
            carrier: input.carrier ?? DEFAULT_SHIPMENT_CARRIER,
            status: ShipmentStatus.PENDING,
          },
        },
      );
    }

    if (input.carrier && input.carrier !== shipment.carrier) {
      shipment = await this.shipments.updateCarrier(
        shipment.id,
        input.carrier,
        {
          ...actor,
          action: 'SHIPMENT_CARRIER_UPDATED',
          entityId: shipment.id,
          beforeData: { carrier: shipment.carrier },
          afterData: { carrier: input.carrier },
        },
      );
    }

    if (
      input.trackingNumber &&
      input.trackingNumber !== shipment.trackingNumber
    ) {
      shipment = await this.shipments.updateTrackingNumber(
        shipment.id,
        input.trackingNumber,
        {
          ...actor,
          action: 'SHIPMENT_TRACKING_UPDATED',
          entityId: shipment.id,
          beforeData: { trackingNumber: shipment.trackingNumber },
          afterData: { trackingNumber: input.trackingNumber },
        },
      );
    }

    if (!input.status || input.status === shipment.status) return shipment;
    if (!transitions[shipment.status].includes(input.status)) {
      throw new AppError(
        'The requested shipment status transition is not allowed.',
        'INVALID_SHIPMENT_STATUS_TRANSITION',
        409,
      );
    }
    if (input.status === ShipmentStatus.SHIPPED && !shipment.trackingNumber) {
      throw new AppError(
        'A tracking number is required before shipping.',
        'TRACKING_NUMBER_REQUIRED',
        422,
      );
    }

    const audit = {
      ...actor,
      entityId: shipment.id,
      beforeData: { status: shipment.status },
      afterData: { status: input.status },
    };
    if (input.status === ShipmentStatus.SHIPPED) {
      return this.shipments.markShipped(
        shipment.id,
        input.shippedAt ?? new Date(),
        {
          ...audit,
          action: 'SHIPMENT_MARKED_SHIPPED',
        },
      );
    }
    if (input.status === ShipmentStatus.DELIVERED) {
      return this.shipments.markDelivered(shipment.id, new Date(), {
        ...audit,
        action: 'SHIPMENT_MARKED_DELIVERED',
      });
    }
    return this.shipments.updateStatus(shipment.id, input.status, {
      ...audit,
      action: 'SHIPMENT_STATUS_UPDATED',
    });
  }
}
