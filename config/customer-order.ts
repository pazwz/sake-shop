import type { OrderStatus, PaymentStatus, ShipmentStatus } from '@prisma/client';

export const CUSTOMER_ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'ご注文を受け付けました', PAID: 'お支払いを確認しました', PROCESSING: '発送準備中',
  READY_TO_SHIP: '発送準備が整いました', SHIPPED: '発送済み', COMPLETED: 'お届け完了',
  CANCELLED: 'キャンセル', REFUNDED: '返金済み',
};
export const CUSTOMER_SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: '配送準備前', PREPARING: '配送準備中', SHIPPED: '発送済み', DELIVERED: 'お届け完了', RETURNED: '返送', CANCELLED: '配送キャンセル',
};
export const CUSTOMER_SHIPMENT_CARRIER_LABELS: Record<string, string> = { SAGAWA: '佐川急便', YAMATO: 'ヤマト運輸', JP_POST: '日本郵便' };

export const CUSTOMER_PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'お支払い待ち',
  SUCCEEDED: '支払済み',
  FAILED: 'お支払いに失敗しました',
  CANCELLED: 'お支払いキャンセル',
  REFUNDED: '返金済み',
  REQUIRES_REVIEW: 'お支払い状況を確認中',
};

// Only explicitly known methods are presented; gateway/provider identifiers
// alone do not establish which payment method the customer used.
export const CUSTOMER_PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD: 'クレジットカード',
  card: 'クレジットカード',
  CREDIT_CARD: 'クレジットカード',
  credit_card: 'クレジットカード',
  PAYPAY: 'PayPay',
  paypay: 'PayPay',
  BANK_TRANSFER: '銀行振込',
  bank_transfer: '銀行振込',
  CASH_ON_DELIVERY: '代金引換',
  cash_on_delivery: '代金引換',
};
