const percentPattern = /^\s*(\d+(?:\.\d+)?)\s*%?\s*$/;

/**
 * Converts the customer workbook's fractional or percentage ABV value into the
 * Product.alcoholPercentage convention: a human-readable percent (e.g. 15.2).
 */
export const normalizeCustomerConfirmedAlcoholPercentage = (
  value: unknown,
): number | null => {
  const raw =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim().match(percentPattern)?.[1])
        : Number.NaN;

  if (!Number.isFinite(raw) || raw <= 0) return null;
  const percentage = raw > 0 && raw < 1 ? raw * 100 : raw;
  if (percentage > 100) return null;

  return Number(percentage.toFixed(2));
};

export const isMissingAlcoholPercentage = (value: number | null) =>
  value === null || !Number.isFinite(value) || value <= 0;

export const isInvalidAlcoholPercentage = (value: number | null) =>
  value !== null && (!Number.isFinite(value) || value <= 0 || value > 100);

const placeholderPatterns = [
  /lorem\s+ipsum/i,
  /dummy/i,
  /\btodo\b/i,
  /テスト/,
  /サンプル/,
  /^\s*商品説明\s*$/,
];

export const getDescriptionContentStatus = (description: string | null) => {
  const normalized = description?.trim() ?? '';
  if (!normalized) return 'MISSING' as const;
  if (placeholderPatterns.some((pattern) => pattern.test(normalized)))
    return 'PLACEHOLDER' as const;
  return 'OK' as const;
};
