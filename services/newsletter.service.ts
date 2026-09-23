import { randomUUID } from 'node:crypto';
import { UnauthorizedError } from '@/lib/errors';
import {
  createEmailActionToken,
  hashEmailActionToken,
  isValidEmailActionToken,
} from '@/lib/email-action-token';
import { NewsletterRepository } from '@/repositories/newsletter.repository';
import { EmailDispatchTriggerService } from '@/services/email-dispatch-trigger.service';

export class NewsletterService {
  public constructor(
    private readonly newsletters = new NewsletterRepository(),
    private readonly trigger = new EmailDispatchTriggerService(),
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
    await this.trigger.trigger();
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
    await this.trigger.trigger();
    return { unsubscribed: true };
  }

  async getCustomerPreference(email: string) {
    const preference = await this.newsletters.getStatus(email);
    return {
      subscribed: preference?.status === 'SUBSCRIBED',
      consentAt: preference?.consentAt ?? null,
      unsubscribedAt: preference?.unsubscribedAt ?? null,
    };
  }

  async setCustomerPreference(email: string, subscribed: boolean) {
    if (subscribed) {
      await this.subscribe(email, 'CUSTOMER_ACCOUNT');
      return { subscribed: true };
    }
    await this.newsletters.unsubscribeByEmail(email, new Date());
    await this.trigger.trigger();
    return { subscribed: false };
  }
}
