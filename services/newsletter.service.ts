import { randomUUID } from 'node:crypto';
import { UnauthorizedError } from '@/lib/errors';
import {
  createEmailActionToken,
  hashEmailActionToken,
} from '@/lib/email-action-token';
import { getNewsletterUnsubscribeTokenHash } from '@/lib/newsletter-unsubscribe-token';
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
    const tokenHash = getNewsletterUnsubscribeTokenHash(token);
    if (!tokenHash)
      throw new UnauthorizedError(
        'このリンクは無効、または有効期限が切れています',
      );
    const result = await this.newsletters.unsubscribe(tokenHash, new Date());
    if (!result)
      throw new UnauthorizedError(
        'このリンクは無効、または有効期限が切れています',
      );
    await this.trigger.trigger();
    return { unsubscribed: true };
  }

  async getUnsubscribeState(
    token: string,
  ): Promise<'confirm' | 'already' | 'invalid'> {
    const hash = getNewsletterUnsubscribeTokenHash(token);
    if (!hash) return 'invalid';
    const subscription = await this.newsletters.getUnsubscribeStatus(hash);
    if (!subscription) return 'invalid';
    return subscription.status === 'UNSUBSCRIBED' ? 'already' : 'confirm';
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
