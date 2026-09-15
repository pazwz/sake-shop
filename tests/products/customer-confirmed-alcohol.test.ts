import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDescriptionContentStatus,
  isInvalidAlcoholPercentage,
  isMissingAlcoholPercentage,
  normalizeCustomerConfirmedAlcoholPercentage,
} from '@/lib/customer-confirmed-alcohol';
import { mapSmaregiProductUpdate } from '@/services/smaregi/smaregi-mapper';

test('normalizes fractional customer-confirmed alcohol values to percent', () => {
  assert.equal(normalizeCustomerConfirmedAlcoholPercentage(0.152), 15.2);
  assert.equal(normalizeCustomerConfirmedAlcoholPercentage(0.668), 66.8);
  assert.equal(normalizeCustomerConfirmedAlcoholPercentage('0.13'), 13);
});

test('keeps already-normalized alcohol values in percent', () => {
  assert.equal(normalizeCustomerConfirmedAlcoholPercentage('43%'), 43);
  assert.equal(normalizeCustomerConfirmedAlcoholPercentage('58.6'), 58.6);
  assert.equal(normalizeCustomerConfirmedAlcoholPercentage('15.2%'), 15.2);
});

test('fails closed for blank, zero, negative, and out-of-range alcohol values', () => {
  for (const value of [null, '', '0%', -1, 0, 100.1, 'not-a-number'])
    assert.equal(normalizeCustomerConfirmedAlcoholPercentage(value), null);
  assert.equal(isMissingAlcoholPercentage(null), true);
  assert.equal(isMissingAlcoholPercentage(0), true);
  assert.equal(isInvalidAlcoholPercentage(101), true);
});

test('identifies blank and placeholder product descriptions', () => {
  assert.equal(getDescriptionContentStatus(null), 'MISSING');
  assert.equal(getDescriptionContentStatus('  '), 'MISSING');
  assert.equal(getDescriptionContentStatus('Lorem ipsum'), 'PLACEHOLDER');
  assert.equal(getDescriptionContentStatus('商品説明'), 'PLACEHOLDER');
  assert.equal(getDescriptionContentStatus('正規の商品説明です。'), 'OK');
});

test('Smaregi product updates never include the LINXAS-owned alcohol field', () => {
  const update = mapSmaregiProductUpdate(
    {
      productId: '8000001',
      productCode: 'CODE-1',
      productName: 'Test product',
      categoryId: '1',
      price: '1000',
      displayFlag: '1',
      salesDivision: '0',
      division: '0',
      taxDivision: '0',
      useCategoryReduceTax: '0',
      reduceTaxId: null,
    },
    'category-1',
  );
  assert.equal('alcoholPercentage' in update, false);
});
