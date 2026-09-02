import { AppError } from '@/lib/errors';
import type {
  SmaregiCategory,
  SmaregiConsumptionTaxRate,
  SmaregiProduct,
  SmaregiReduceTaxRate,
} from '@/types/smaregi';

export const SMAREGI_TAX_BLOCK_CODES = [
  'CATEGORY_NOT_FOUND',
  'CATEGORY_TAX_DIVISION_MISSING',
  'INVALID_TARGET_DATE',
  'INVALID_PRICE',
  'INVALID_TAX_RATE',
  'STANDARD_TAX_RATE_NOT_FOUND',
  'STANDARD_TAX_RATE_AMBIGUOUS',
  'REDUCE_TAX_RATE_NOT_FOUND',
  'REDUCE_TAX_RATE_AMBIGUOUS',
  'DYNAMIC_REDUCE_TAX_UNSUPPORTED',
  'TAX_EXCLUSIVE_PRICE_UNSUPPORTED',
  'TAX_EXEMPT_PRICE_UNSUPPORTED',
] as const;

export type SmaregiTaxBlockCode = (typeof SMAREGI_TAX_BLOCK_CODES)[number];

export class SmaregiTaxResolutionError extends AppError {
  public constructor(public readonly blockCode: SmaregiTaxBlockCode) {
    super(
      `Smaregi tax resolution blocked: ${blockCode}.`,
      'SMAREGI_TAX_RESOLUTION_BLOCKED',
      422,
    );
    this.name = 'SmaregiTaxResolutionError';
  }
}

export type ResolvedSmaregiProductTax = {
  price: string;
  taxDivision: '0';
  resolvedTaxRate: string;
  priceMeaning: 'taxIncluded';
  taxResolutionSource:
    | 'category.standard'
    | 'category.reduced'
    | 'product.standard'
    | 'product.reduced';
};

export const getSmaregiTargetDate = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export const resolveStandardTaxRate = (
  rates: SmaregiConsumptionTaxRate[],
  targetDate: string,
) => {
  assertDate(targetDate);
  const applicable = rates.filter((rate) => {
    assertDate(rate.applyStartDate);
    return rate.applyStartDate <= targetDate;
  });
  if (applicable.length === 0)
    throw new SmaregiTaxResolutionError('STANDARD_TAX_RATE_NOT_FOUND');
  const latestDate = applicable.reduce(
    (latest, rate) =>
      rate.applyStartDate > latest ? rate.applyStartDate : latest,
    applicable[0].applyStartDate,
  );
  const latest = applicable.filter(
    (rate) => rate.applyStartDate === latestDate,
  );
  if (latest.length !== 1)
    throw new SmaregiTaxResolutionError('STANDARD_TAX_RATE_AMBIGUOUS');
  return normalizeTaxRate(latest[0].taxRate);
};

export const resolveReduceTaxRate = (
  rates: SmaregiReduceTaxRate[],
  reduceTaxId: string,
  targetDate: string,
) => {
  assertDate(targetDate);
  const applicable = rates.filter((rate) => {
    assertDate(rate.termStart);
    if (rate.termEnd !== null) assertDate(rate.termEnd);
    return (
      rate.reduceTaxId === reduceTaxId &&
      rate.termStart <= targetDate &&
      (rate.termEnd === null || targetDate <= rate.termEnd)
    );
  });
  if (applicable.length === 0)
    throw new SmaregiTaxResolutionError('REDUCE_TAX_RATE_NOT_FOUND');
  if (applicable.length !== 1)
    throw new SmaregiTaxResolutionError('REDUCE_TAX_RATE_AMBIGUOUS');
  if (applicable[0].division === '2')
    throw new SmaregiTaxResolutionError('DYNAMIC_REDUCE_TAX_UNSUPPORTED');
  return normalizeTaxRate(applicable[0].rate);
};

export const resolveProductTax = (
  product: SmaregiProduct,
  category: SmaregiCategory | undefined,
  standardRates: SmaregiConsumptionTaxRate[],
  reduceRates: SmaregiReduceTaxRate[],
  targetDate: string,
): ResolvedSmaregiProductTax => {
  if (!category) throw new SmaregiTaxResolutionError('CATEGORY_NOT_FOUND');
  const useCategory = product.useCategoryReduceTax === '1';
  const taxDivision = useCategory ? category.taxDivision : product.taxDivision;
  const reduceTaxId = useCategory ? category.reduceTaxId : product.reduceTaxId;
  if (taxDivision === null)
    throw new SmaregiTaxResolutionError('CATEGORY_TAX_DIVISION_MISSING');
  if (taxDivision === '1')
    throw new SmaregiTaxResolutionError('TAX_EXCLUSIVE_PRICE_UNSUPPORTED');
  if (taxDivision === '2')
    throw new SmaregiTaxResolutionError('TAX_EXEMPT_PRICE_UNSUPPORTED');

  const source = useCategory ? 'category' : 'product';
  return {
    price: normalizePrice(product.price),
    taxDivision,
    resolvedTaxRate:
      reduceTaxId === null
        ? resolveStandardTaxRate(standardRates, targetDate)
        : resolveReduceTaxRate(reduceRates, reduceTaxId, targetDate),
    priceMeaning: 'taxIncluded',
    taxResolutionSource: `${source}.${
      reduceTaxId === null ? 'standard' : 'reduced'
    }` as ResolvedSmaregiProductTax['taxResolutionSource'],
  };
};

const normalizePrice = (value: string) => {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new SmaregiTaxResolutionError('INVALID_PRICE');
  const [whole, fraction = ''] = value.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  const normalizedFraction = fraction.replace(/0+$/, '');
  return normalizedFraction
    ? `${normalizedWhole}.${normalizedFraction}`
    : normalizedWhole;
};

const normalizeTaxRate = (value: string) => {
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(value))
    throw new SmaregiTaxResolutionError('INVALID_TAX_RATE');
  const [whole, fraction = ''] = value.split('.');
  const padded = fraction.padEnd(3, '0');
  if (padded[2] !== '0')
    throw new SmaregiTaxResolutionError('INVALID_TAX_RATE');
  return `${whole.replace(/^0+(?=\d)/, '')}.${padded.slice(0, 2)}`;
};

const assertDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new SmaregiTaxResolutionError('INVALID_TARGET_DATE');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new SmaregiTaxResolutionError('INVALID_TARGET_DATE');
};
