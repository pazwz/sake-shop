import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '@/lib/errors';
import { ShippingQuoteService } from '@/services/shipping-quote.service';
import { orderValidator } from '@/validators/order.validator';

const validQuote = {
  prefecture: '福岡県',
  items: [
    {
      productId: 'product-1',
      quantity: 2,
      packageType: 'BOTTLE' as const,
      requiresCoolDelivery: false,
    },
  ],
  quantity: 2,
  packageType: 'BOTTLE' as const,
  requiresCoolDelivery: false,
  subtotal: 10_000,
};

test('shipping quote uses the centralized development placeholder breakdown', () => {
  const quote = new ShippingQuoteService().quote(validQuote);
  assert.deepEqual(quote, {
    baseFee: 880,
    coolFee: 0,
    remoteAreaFee: 0,
    totalShipping: 880,
    method: 'development-standard',
    carrier: 'SAGAWA',
    calculationBreakdown: {
      policyVersion: 'development-placeholder-v1',
      baseFee: 880,
      coolFee: 0,
      remoteAreaFee: 0,
      note: '正式な佐川急便送料表の承認前に使用する開発用暫定見積もり',
    },
  });
});

test('unsupported shipping destination is rejected until official rates exist', () => {
  assert.throws(
    () =>
      new ShippingQuoteService().quote({
        ...validQuote,
        prefecture: '東京都',
      }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === 'SHIPPING_DESTINATION_UNSUPPORTED',
  );
});

test('cool delivery fails closed until an approved rule exists', () => {
  assert.throws(
    () =>
      new ShippingQuoteService().quote({
        ...validQuote,
        requiresCoolDelivery: true,
      }),
    (error: unknown) =>
      error instanceof AppError && error.code === 'SHIPPING_RULE_UNAVAILABLE',
  );
});

test('checkout cannot forge shipping fee or shipping method', () => {
  const validOrder = {
    items: [{ productId: 'cm1234567890abcdefghijklmnop', quantity: 1 }],
    address: {
      postalCode: '810-0001',
      prefecture: '福岡県',
      city: '福岡市',
      addressLine1: '1-1',
      recipientName: 'Buyer',
      phone: '09000000000',
    },
    ageConfirmed: true,
    paymentMethod: 'card',
  };
  assert.equal(orderValidator.safeParse(validOrder).success, true);
  assert.equal(
    orderValidator.safeParse({ ...validOrder, shippingFee: 1 }).success,
    false,
  );
  assert.equal(
    orderValidator.safeParse({
      ...validOrder,
      shippingMethod: 'client-forged',
    }).success,
    false,
  );
});
