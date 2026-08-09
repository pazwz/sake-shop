import { Prisma, ShipmentCarrier, ShipmentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type AuditInput = {
  adminUserId: string;
  action: string;
  entityId: string;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
};

const shipmentInclude = { order: true } satisfies Prisma.ShipmentInclude;

export class ShipmentRepository {
  findById(id: string) {
    return prisma.shipment.findUnique({
      where: { id },
      include: shipmentInclude,
    });
  }

  findByOrderId(orderId: string) {
    return prisma.shipment.findFirst({
      where: { orderId },
      include: shipmentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(
    input: {
      orderId: string;
      carrier: ShipmentCarrier;
      shippingMethod: string;
    },
    audit: AuditInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: input,
        include: shipmentInclude,
      });
      await tx.order.update({
        where: { id: input.orderId },
        data: { shipmentStatus: ShipmentStatus.PENDING },
      });
      await this.createAuditLog(tx, { ...audit, entityId: shipment.id });
      return shipment;
    });
  }

  updateCarrier(id: string, carrier: ShipmentCarrier, audit: AuditInput) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.update({
        where: { id },
        data: { carrier },
        include: shipmentInclude,
      });
      await this.createAuditLog(tx, audit);
      return shipment;
    });
  }

  updateTrackingNumber(id: string, trackingNumber: string, audit: AuditInput) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.update({
        where: { id },
        data: { trackingNumber },
        include: shipmentInclude,
      });
      await this.createAuditLog(tx, audit);
      return shipment;
    });
  }

  updateStatus(id: string, status: ShipmentStatus, audit: AuditInput) {
    return this.updateStatusWithDates(id, status, {}, audit);
  }

  markShipped(id: string, shippedAt: Date, audit: AuditInput) {
    return this.updateStatusWithDates(
      id,
      ShipmentStatus.SHIPPED,
      { shippedAt },
      audit,
    );
  }

  markDelivered(id: string, deliveredAt: Date, audit: AuditInput) {
    return this.updateStatusWithDates(
      id,
      ShipmentStatus.DELIVERED,
      { deliveredAt },
      audit,
    );
  }

  private async updateStatusWithDates(
    id: string,
    status: ShipmentStatus,
    dates: { shippedAt?: Date; deliveredAt?: Date },
    audit: AuditInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.update({
        where: { id },
        data: { status, ...dates },
        include: shipmentInclude,
      });
      await tx.order.update({
        where: { id: shipment.orderId },
        data: { shipmentStatus: status },
      });
      await this.createAuditLog(tx, audit);
      return shipment;
    });
  }

  private createAuditLog(tx: Prisma.TransactionClient, audit: AuditInput) {
    return tx.auditLog.create({
      data: {
        adminUserId: audit.adminUserId,
        action: audit.action,
        entityType: 'Shipment',
        entityId: audit.entityId,
        beforeData: audit.beforeData,
        afterData: audit.afterData,
      },
    });
  }
}
