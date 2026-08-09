import { ShipmentCarrier, ShipmentStatus } from '@prisma/client';
import { z } from 'zod';

const trackingNumber = z
  .string()
  .trim()
  .min(6)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/);

export const shipmentUpdateValidator = z.object({
  carrier: z.nativeEnum(ShipmentCarrier).optional(),
  trackingNumber: trackingNumber.optional(),
  shippedAt: z.coerce.date().optional(),
  status: z.nativeEnum(ShipmentStatus).optional(),
});

export type ShipmentUpdateInput = z.infer<typeof shipmentUpdateValidator>;
