import { EMAIL_LOCK_TIMEOUT_MS, EMAIL_PROCESS_BATCH_SIZE } from '@/config/email';
import { EmailOutboxRepository } from '@/repositories/email-outbox.repository';
import { NewsletterCampaignRepository } from '@/repositories/newsletter-campaign.repository';
import { EmailOutboxService } from '@/services/email-outbox.service';
import { EmailEventTransport, emailEventValidator, type EmailEvent } from '@/services/email-event-transport.service';

export class EmailEventService {
  constructor(
    private readonly outbox = new EmailOutboxRepository(),
    private readonly worker = new EmailOutboxService(),
    private readonly campaigns = new NewsletterCampaignRepository(),
    private readonly transport = new EmailEventTransport(),
  ) {}

  /** Event-triggered bounded pages, not periodic polling. Partial failure is safe to repeat. */
  async enqueueDue() {
    let cursor: string | undefined;
    let published = 0;
    do {
      const rows = await this.outbox.findEventCandidates(undefined, cursor);
      for (const row of rows) await this.transport.publish({ kind: 'outbox', outboxId: row.id });
      published += rows.length;
      if (rows.length < EMAIL_PROCESS_BATCH_SIZE) break;
      cursor = rows[rows.length - 1].id;
    } while (cursor);
    return { outcome: 'QUEUED', processed: published };
  }

  async handle(input: EmailEvent) {
    const event = emailEventValidator.parse(input);
    if (event.kind === 'campaign') return this.handleCampaign(event);
    let row = await this.outbox.findEventState(event.outboxId);
    if (!row) return { outcome: 'NOOP', processed: 0 };
    if (['SENT', 'SKIPPED'].includes(row.status) || (row.status === 'FAILED' && !row.nextAttemptAt)) {
      // A prior worker may have committed terminal delivery then crashed before campaign aggregation.
      // Reconcile before ACK; a failed reconciliation must remain a failed queue record.
      if (row.newsletterCampaignId) await this.campaigns.refreshCompletion(row.newsletterCampaignId);
      return { outcome: 'NOOP', processed: 0 };
    }
    const now = new Date();
    if (row.status === 'SENDING' && (!row.lockedAt || row.lockedAt.getTime() > now.getTime() - EMAIL_LOCK_TIMEOUT_MS))
      throw new Error('EMAIL_EVENT_LEASE_BUSY');
    if (row.status !== 'FAILED' || !row.nextAttemptAt || row.nextAttemptAt <= now) {
      const result = await this.worker.processOutbox(event.outboxId);
      if (result.outcome === 'DISABLED') throw new Error('EMAIL_PROVIDER_UNAVAILABLE');
      row = await this.outbox.findEventState(event.outboxId);
    }
    if (row?.status === 'FAILED' && row.nextAttemptAt) await this.transport.schedule(event, row.nextAttemptAt);
    if (row?.status === 'SENDING') throw new Error('EMAIL_EVENT_LEASE_BUSY');
    return { outcome: 'SUCCESS', processed: 1 };
  }

  private async handleCampaign(event: Extract<EmailEvent, { kind: 'campaign' }>) {
    const expected = new Date(event.scheduledAt);
    const campaign = await this.campaigns.findById(event.campaignId);
    if (!campaign || campaign.scheduledAt?.getTime() !== expected.getTime() ||
        !['SCHEDULED', 'SENDING'].includes(campaign.status)) return { outcome: 'NOOP', processed: 0 };
    if (expected > new Date()) {
      await this.transport.schedule(event, expected);
      return { outcome: 'DEFERRED', processed: 0 };
    }
    await this.campaigns.dispatchDueCampaign(event.campaignId, new Date(), expected);
    // On queue publication failure the campaign event is redelivered; SENDING is resumable.
    const rows = await this.outbox.findEventCandidates(event.campaignId, event.afterId);
    for (const row of rows) await this.transport.publish({ kind: 'outbox', outboxId: row.id });
    if (rows.length === EMAIL_PROCESS_BATCH_SIZE)
      await this.transport.publish({ ...event, afterId: rows[rows.length - 1].id });
    return { outcome: 'QUEUED', processed: rows.length };
  }
}
