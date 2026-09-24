import { EmailTemplate } from '@prisma/client';
import { EmailOutboxRepository } from '@/repositories/email-outbox.repository';
import { EmailDispatchTriggerService } from '@/services/email-dispatch-trigger.service';
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
  CONTACT_REPLY: '[LINXAS] お問い合わせについて',
  ORDER_MESSAGE_NOTIFICATION: '【LINXAS】新しいメッセージがあります',
};

export class EmailNotificationService {
  public constructor(
    private readonly outbox = new EmailOutboxRepository(),
    private readonly trigger = new EmailDispatchTriggerService(),
  ) {}

  public async enqueue(input: Omit<EmailOutboxDraft, 'subject'>) {
    const outbox = await this.outbox.enqueue({
      ...input,
      subject: subjects[input.template],
    });
    await this.trigger.trigger(outbox.id);
    return outbox;
  }
}
