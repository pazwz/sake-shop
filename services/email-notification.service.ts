import { EmailTemplate } from '@prisma/client';
import { EmailOutboxRepository } from '@/repositories/email-outbox.repository';
import type { EmailOutboxDraft } from '@/types/email';

const subjects: Record<EmailTemplate, string> = {
  EMAIL_VERIFICATION: 'メールアドレス確認のお願い',
  PASSWORD_RESET: 'パスワード再設定',
  WELCOME: '会員登録が完了しました',
  ORDER_RECEIVED: 'ご注文を承りました',
  PAYMENT_SUCCEEDED: 'お支払いを確認しました',
  PAYMENT_FAILED: 'お支払いを確認できませんでした',
  ORDER_CANCELLED: 'ご注文をキャンセルしました',
  SHIPMENT_SENT: '商品を発送しました',
  NEWSLETTER_CONTACT_SYNC: 'Newsletter contact synchronization',
  NEWSLETTER_CAMPAIGN: 'LINXASからのお知らせ',
  CONTACT_INQUIRY: '[LINXAS EC] お問い合わせ',
};

export class EmailNotificationService {
  public constructor(private readonly outbox = new EmailOutboxRepository()) {}

  public enqueue(input: Omit<EmailOutboxDraft, 'subject'>) {
    return this.outbox.enqueue({ ...input, subject: subjects[input.template] });
  }
}
