import type { OrderStatus, ShipmentStatus } from '@prisma/client';

export const CUSTOMER_ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'ご注文を受け付けました', PAID: 'お支払いを確認しました', PROCESSING: '発送準備中',
  READY_TO_SHIP: '発送準備が整いました', SHIPPED: '発送済み', COMPLETED: 'お届け完了',
  CANCELLED: 'キャンセル', REFUNDED: '返金済み',
};
export const CUSTOMER_SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: '配送準備前', PREPARING: '配送準備中', SHIPPED: '発送済み', DELIVERED: 'お届け完了', RETURNED: '返送', CANCELLED: '配送キャンセル',
};
export const CUSTOMER_SHIPMENT_CARRIER_LABELS: Record<string, string> = { SAGAWA: '佐川急便', YAMATO: 'ヤマト運輸', JP_POST: '日本郵便' };
