import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveProductTax,
  resolveReduceTaxRate,
  resolveStandardTaxRate,
} from '@/services/smaregi/smaregi-tax-resolver';
import { buildValidatedSmaregiSyncPlan } from '@/services/smaregi/smaregi-sync-plan.service';
import type {
  SmaregiCategory,
  SmaregiConsumptionTaxRate,
  SmaregiProduct,
  SmaregiReduceTaxRate,
} from '@/types/smaregi';

const standardRates: SmaregiConsumptionTaxRate[] = [
  {
    applyStartDate: '2014-04-01',
    taxRate: '8.000',
    taxRounding: '1',
  },
  {
    applyStartDate: '2019-10-01',
    taxRate: '10.000',
    taxRounding: '1',
  },
];

const fixedReduceRate: SmaregiReduceTaxRate = {
  reduceTaxId: '10000001',
  division: '1',
  rate: '8.000',
  termStart: '2019-10-01',
  termEnd: null,
};

const category = (
  overrides: Partial<SmaregiCategory> = {},
): SmaregiCategory => ({
  categoryId: '10',
  categoryCode: 'SAKE',
  categoryName: '日本酒',
  displaySequence: '1',
  displayFlag: '1',
  parentCategoryId: null,
  taxDivision: '0',
  reduceTaxId: null,
  ...overrides,
});

const product = (overrides: Partial<SmaregiProduct> = {}): SmaregiProduct => ({
  productId: '100',
  categoryId: '10',
  productCode: 'S-100',
  productName: '同期商品',
  price: '3000',
  displayFlag: '1',
  salesDivision: '0',
  division: '0',
  taxDivision: '0',
  useCategoryReduceTax: '1',
  reduceTaxId: null,
  ...overrides,
});

test('selects the latest standard tax rate effective on the target date', () => {
  assert.equal(resolveStandardTaxRate(standardRates, '2019-09-30'), '8.00');
  assert.equal(resolveStandardTaxRate(standardRates, '2026-08-27'), '10.00');
});

test('selects one fixed reduced tax rate by ID and effective period', () => {
  assert.equal(
    resolveReduceTaxRate([fixedReduceRate], '10000001', '2026-08-27'),
    '8.00',
  );
});

test('resolves category standard tax and product fixed reduced tax', () => {
  assert.deepEqual(
    resolveProductTax(
      product(),
      category(),
      standardRates,
      [fixedReduceRate],
      '2026-08-27',
    ),
    {
      price: '3000',
      taxDivision: '0',
      resolvedTaxRate: '10.00',
      priceMeaning: 'taxIncluded',
      taxResolutionSource: 'category.standard',
    },
  );
  assert.equal(
    resolveProductTax(
      product({ useCategoryReduceTax: '0', reduceTaxId: '10000001' }),
      category(),
      standardRates,
      [fixedReduceRate],
      '2026-08-27',
    ).taxResolutionSource,
    'product.reduced',
  );
});

test('fails closed for dynamic, exclusive, missing, and ambiguous tax data', () => {
  const dynamicRate: SmaregiReduceTaxRate = {
    ...fixedReduceRate,
    reduceTaxId: '10000004',
    division: '2',
  };
  assert.throws(
    () =>
      resolveProductTax(
        product(),
        category({ taxDivision: null }),
        standardRates,
        [],
        '2026-08-27',
      ),
    { blockCode: 'CATEGORY_TAX_DIVISION_MISSING' },
  );
  assert.throws(
    () =>
      resolveProductTax(
        product({ useCategoryReduceTax: '0', reduceTaxId: '10000004' }),
        category(),
        standardRates,
        [dynamicRate],
        '2026-08-27',
      ),
    { blockCode: 'DYNAMIC_REDUCE_TAX_UNSUPPORTED' },
  );
  assert.throws(
    () =>
      resolveProductTax(
        product(),
        category({ taxDivision: '1' }),
        standardRates,
        [],
        '2026-08-27',
      ),
    { blockCode: 'TAX_EXCLUSIVE_PRICE_UNSUPPORTED' },
  );
  assert.throws(
    () => resolveProductTax(product(), category(), [], [], '2026-08-27'),
    { blockCode: 'STANDARD_TAX_RATE_NOT_FOUND' },
  );
  assert.throws(
    () =>
      resolveStandardTaxRate(
        [standardRates[1], { ...standardRates[1], taxRate: '8.000' }],
        '2026-08-27',
      ),
    { blockCode: 'STANDARD_TAX_RATE_AMBIGUOUS' },
  );
});

test('builds a write plan with resolved tax and explicit missing-stock zero', () => {
  const plan = buildValidatedSmaregiSyncPlan({
    targetDate: '2026-08-27',
    syncedAt: new Date('2026-08-27T00:00:00.000Z'),
    stores: [{ storeId: '1' }],
    categories: [category()],
    products: [product({ productCode: 'TEST-WINE-001' })],
    stock: [],
    standardTaxRates: standardRates,
    reduceTaxRates: [fixedReduceRate],
  });

  assert.equal(plan.products[0].resolvedTaxRate, '10.00');
  assert.deepEqual(plan.inventory[0], {
    smaregiProductId: '100',
    smaregiStoreId: '1',
    quantity: 0,
  });
});
