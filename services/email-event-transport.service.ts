import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AwsEmailEventAdapter } from '@/services/email-event-adapters/aws-email-event.adapter';

export const emailEventValidator = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('outbox'), outboxId: z.string().min(1).max(128) }).strict(),
  z.object({ kind: z.literal('campaign'), campaignId: z.string().min(1).max(128), scheduledAt: z.string().datetime(), afterId: z.string().min(1).max(128).optional() }).strict(),
]);
export type EmailEvent = z.infer<typeof emailEventValidator>;
export interface EmailEventAdapter {
  publish(event: EmailEvent): Promise<void>;
  schedule(name: string, event: EmailEvent, at: Date): Promise<void>;
  cancel(name: string): Promise<void>;
}

export const emailScheduleName = (event: EmailEvent, at: Date) =>
  'email-' + createHash('sha256').update(JSON.stringify([event, at.toISOString()])).digest('hex').slice(0, 48);

export class EmailEventTransport {
  constructor(private readonly adapter: EmailEventAdapter = new AwsEmailEventAdapter()) {}

  async publish(input: EmailEvent) {
    const event = emailEventValidator.parse(input);
    try { await this.adapter.publish(event); }
    catch { throw new Error('EMAIL_EVENT_HANDOFF_FAILED'); }
  }

  async schedule(input: EmailEvent, at: Date) {
    const event = emailEventValidator.parse(input);
    if (!Number.isFinite(at.getTime())) throw new Error('EMAIL_EVENT_DATE_INVALID');
    try { await this.adapter.schedule(emailScheduleName(event, at), event, at); }
    catch { throw new Error('EMAIL_EVENT_SCHEDULE_FAILED'); }
  }

  async cancel(input: EmailEvent, at: Date) {
    const event = emailEventValidator.parse(input);
    try { await this.adapter.cancel(emailScheduleName(event, at)); }
    catch { throw new Error('EMAIL_EVENT_CANCEL_FAILED'); }
  }
}
