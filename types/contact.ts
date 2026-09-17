export const CONTACT_TOPICS = {
  PRODUCT: '商品について',
  SHIPPING: '配送について',
  PRE_ORDER: 'ご注文前のご相談',
  ORDER_CHANGE_CANCEL: '注文内容の変更・キャンセル',
  OTHER: 'その他',
} as const;

export type ContactTopic = keyof typeof CONTACT_TOPICS;

export type ContactOrderReferenceStatus =
  | 'NOT_PROVIDED'
  | 'VERIFIED'
  | 'UNVERIFIED';
