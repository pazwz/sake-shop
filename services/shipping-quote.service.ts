import { DEVELOPMENT_SHIPPING_RULE } from '@/config/shipping';
import { AppError } from '@/lib/errors';
import type { ShippingQuote, ShippingQuoteInput } from '@/types/shipping';

const unsupportedDestination = () =>
  new AppError(
    'この配送先の送料は現在確認中です。',
    'SHIPPING_DESTINATION_UNSUPPORTED',
    422,
  );

const unavailableRule = () =>
  new AppError(
    'この商品の配送方法は現在確認中です。',
    'SHIPPING_RULE_UNAVAILABLE',
    422,
  );

export class ShippingQuoteService {
  public quote(input: ShippingQuoteInput): ShippingQuote {
    const rule = DEVELOPMENT_SHIPPING_RULE;
    if (
      !rule.supportedPrefectures.some(
        (prefecture) => prefecture === input.prefecture,
      )
    )
      throw unsupportedDestination();

    if (
      input.requiresCoolDelivery ||
      input.items.some((item) => item.requiresCoolDelivery)
    )
      throw unavailableRule();

    if (input.items.length === 0 || input.quantity <= 0 || input.subtotal < 0)
      throw new AppError(
        '配送見積もりの入力が正しくありません。',
        'INVALID_SHIPPING_QUOTE_INPUT',
        422,
      );

    const baseFee = rule.baseFee;
    const coolFee = 0;
    const remoteAreaFee = 0;
    return {
      baseFee,
      coolFee,
      remoteAreaFee,
      totalShipping: baseFee + coolFee + remoteAreaFee,
      method: rule.method,
      carrier: rule.carrier,
      calculationBreakdown: {
        policyVersion: rule.policyVersion,
        baseFee,
        coolFee,
        remoteAreaFee,
        note: '正式な佐川急便送料表の承認前に使用する開発用暫定見積もり',
      },
    };
  }
}
