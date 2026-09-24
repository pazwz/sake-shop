import { createErrorResponse } from '@/lib/api-response';

/** Historic integrations receive a safe business response; no anonymous thread is created. */
export const POST = async () =>
  createErrorResponse(
    'CONTACT_DISABLED',
    'ご注文に関するお問い合わせはMY PAGEの注文履歴よりお願いいたします。',
    410,
  );
