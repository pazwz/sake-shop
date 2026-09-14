import { createHash } from 'node:crypto';
import { EmailTemplate } from '@prisma/client';
import {
  EMAIL_MAX_ATTEMPTS,
  EMAIL_LOCK_TIMEOUT_MS,
  EMAIL_PROCESS_BATCH_SIZE,
  EMAIL_RETRY_DELAYS_MS,
  getEmailRuntimeConfig,
} from '@/config/email';
import { EmailOutboxRepository } from '@/repositories/email-outbox.repository';
import { getEmailAdapter } from '@/services/email-adapters/email-adapter.factory';
import { EmailTemplateService } from '@/services/email-template.service';
import { ResendMarketingContactService } from '@/services/resend-marketing-contact.service';
import type { EmailProviderAdapter } from '@/types/email';

export class EmailOutboxService {
  public constructor(
    private readonly outbox = new EmailOutboxRepository(),
    private readonly templates = new EmailTemplateService(),
    private readonly adapter: EmailProviderAdapter | null = getEmailAdapter(),
    private readonly marketing = new ResendMarketingContactService(),
  ) {}

  public async processDue(limit = EMAIL_PROCESS_BATCH_SIZE) {
    const config = getEmailRuntimeConfig();
    if (!config.available || !this.adapter)
      return { outcome: 'DISABLED', processed: 0, sent: 0, failed: 0 };
    const now = new Date();
    const rows = await this.outbox.claimDue(
      Math.min(limit, EMAIL_PROCESS_BATCH_SIZE),
      now,
      new Date(now.getTime() - EMAIL_LOCK_TIMEOUT_MS),
    );
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const payload = row.payload as Record<string, unknown>;
        if (row.template === EmailTemplate.NEWSLETTER_CONTACT_SYNC) {
          if (config.mode === 'resend') {
            const result = await this.marketing.sync({
              email: row.recipient,
              unsubscribed: payload.unsubscribed === true,
            });
            await this.outbox.markContactSynced(
              row.recipient,
              result.contactId,
            );
            await this.outbox.markSent(
              row.id,
              'resend-contacts',
              `contact-${row.id}`,
            );
          } else {
            await this.outbox.markSent(
              row.id,
              this.adapter.provider,
              `contact-${row.id}`,
            );
          }
        } else {
          const rendered = this.templates.render(row.template, payload);
          const result = await this.adapter.send({
            to: row.recipient,
            ...rendered,
            idempotencyKey: `email-outbox:${row.id}`,
          });
          await this.outbox.markSent(
            row.id,
            this.adapter.provider,
            result.messageId,
          );
        }
        sent += 1;
      } catch (error) {
        failed += 1;
        const nextAttempt = row.attemptCount + 1;
        const delay = EMAIL_RETRY_DELAYS_MS[nextAttempt - 1];
        await this.outbox.markFailed(
          row.id,
          error instanceof Error ? error.message : 'EMAIL_DELIVERY_FAILED',
          nextAttempt >= EMAIL_MAX_ATTEMPTS || delay === undefined
            ? null
            : new Date(Date.now() + delay),
        );
      }
    }
    return {
      outcome: failed ? 'SUCCESS_WITH_WARNINGS' : 'SUCCESS',
      processed: rows.length,
      sent,
      failed,
    };
  }

  public recordWebhook(input: {
    providerEventId: string;
    type: string;
    rawPayload: string;
    providerMessageId?: string;
    recipient?: string;
    contactUnsubscribed?: boolean;
  }) {
    return this.outbox.recordWebhook({
      ...input,
      payloadHash: createHash('sha256').update(input.rawPayload).digest('hex'),
    });
  }
}
