import { ShipmentCarrier } from '@prisma/client';
import { DEVELOPMENT_SHIPPING_FEE } from '@/config/order';

export const DEFAULT_SHIPMENT_CARRIER = ShipmentCarrier.SAGAWA;
export const DEVELOPMENT_SHIPPING_METHOD = 'development-standard';
export const DEVELOPMENT_SHIPPING_POLICY_VERSION = 'development-placeholder-v1';

/**
 * This allowlist is intentionally narrow until the contracted Sagawa rate
 * table, remote-island policy, and cool-delivery rules are approved.
 */
export const DEVELOPMENT_SUPPORTED_PREFECTURES = ['福岡県'] as const;

export const DEVELOPMENT_SHIPPING_RULE = {
  policyVersion: DEVELOPMENT_SHIPPING_POLICY_VERSION,
  method: DEVELOPMENT_SHIPPING_METHOD,
  carrier: DEFAULT_SHIPMENT_CARRIER,
  baseFee: DEVELOPMENT_SHIPPING_FEE,
  coolFee: null,
  remoteAreaFee: null,
  supportedPrefectures: DEVELOPMENT_SUPPORTED_PREFECTURES,
} as const;
