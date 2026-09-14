import type { EmailMessage, EmailProviderAdapter } from '@/types/email';

export class ConsoleEmailAdapter implements EmailProviderAdapter {
  public readonly provider = 'console';

  public async send(message: EmailMessage) {
    return { messageId: `console:${message.idempotencyKey}` };
  }
}
