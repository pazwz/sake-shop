import { Resend } from 'resend';
import type { EmailMessage, EmailProviderAdapter } from '@/types/email';

export class ResendEmailAdapter implements EmailProviderAdapter {
  public readonly provider = 'resend';
  private readonly resend: Resend;

  public constructor(
    apiKey = process.env.RESEND_API_KEY,
    private readonly from = process.env.RESEND_FROM_EMAIL,
    private readonly replyTo = process.env.RESEND_REPLY_TO_EMAIL,
  ) {
    if (!apiKey || !from) throw new Error('RESEND_CONFIGURATION_MISSING');
    this.resend = new Resend(apiKey);
  }

  public async send(message: EmailMessage) {
    const replyTo = message.replyTo ?? this.replyTo;
    const result = await this.resend.emails.send(
      {
        from: this.from!,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(replyTo ? { replyTo } : {}),
      },
      { idempotencyKey: message.idempotencyKey },
    );
    if (result.error || !result.data?.id)
      throw new Error(result.error?.name ?? 'RESEND_SEND_FAILED');
    return { messageId: result.data.id };
  }
}
