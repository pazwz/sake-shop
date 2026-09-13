export type ShippingPackageType = 'BOTTLE' | 'BOXED_BOTTLE';

export type ShippingQuoteItem = {
  productId: string;
  quantity: number;
  packageType: ShippingPackageType;
  requiresCoolDelivery: boolean;
};

export type ShippingQuoteInput = {
  prefecture: string;
  items: ShippingQuoteItem[];
  quantity: number;
  packageType: ShippingPackageType;
  requiresCoolDelivery: boolean;
  subtotal: number;
};

export type ShippingCalculationBreakdown = {
  policyVersion: string;
  baseFee: number;
  coolFee: number;
  remoteAreaFee: number;
  note: string;
};

export type ShippingQuote = {
  baseFee: number;
  coolFee: number;
  remoteAreaFee: number;
  totalShipping: number;
  method: string;
  carrier: string;
  calculationBreakdown: ShippingCalculationBreakdown;
};
