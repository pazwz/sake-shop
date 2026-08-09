import { ShipmentCarrier } from '@prisma/client';
import { DEVELOPMENT_SHIPPING_FEE } from '@/config/order';

export const DEFAULT_SHIPMENT_CARRIER = ShipmentCarrier.SAGAWA;
export const DEVELOPMENT_SHIPPING_METHOD = 'development-standard';

/**
 * Temporary shipping-rule boundary. Replace this implementation with the
 * contracted zone, size, weight, and cool-delivery rate table when available.
 */
export type ShippingQuoteInput = {
  destinationPrefecture?: string;
  packageSize?: string;
  weightGrams?: number;
  requiresCoolDelivery?: boolean;
};

export const getTemporaryShippingQuote = (_input: ShippingQuoteInput = {}) => ({
  fee: DEVELOPMENT_SHIPPING_FEE,
  shippingMethod: DEVELOPMENT_SHIPPING_METHOD,
});
