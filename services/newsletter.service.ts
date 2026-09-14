import { randomUUID } from 'node:crypto';
import { UnauthorizedError } from '@/lib/errors';
import {
  createEmailActionToken,
  hashEmailActionToken,
  isValidEmailActionToken,
} from '@/lib/email-action-token';
import { NewsletterRepository } from '@/repositories/newsletter.repository';

export class NewsletterService {
  public constructor(
    private readonly newsletters = new NewsletterRepository(),
  ) {}

  async subscribe(email: string, source = 'FOOTER') {
    const existing = await this.newsletters.findByEmail(email);
    const id = existing?.id ?? randomUUID();
    const token = createEmailActionToken(id, 'newsletter-unsubscribe');
    await this.newsletters.subscribe({
      id,
      email,
      tokenHash: hashEmailActionToken(token),
      source,
      now: new Date(),
    });
    return { subscribed: true };
  }

  async unsubscribe(token: string) {
    if (!isValidEmailActionToken(token, 'newsletter-unsubscribe'))
      throw new UnauthorizedError('退会リンクが無効です。');
    const result = await this.newsletters.unsubscribe(
      hashEmailActionToken(token),
      new Date(),
    );
    if (!result) throw new UnauthorizedError('退会リンクが無効です。');
    return { unsubscribed: true };
  }
}
