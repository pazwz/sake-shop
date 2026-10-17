import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailEventTransport } from '@/services/email-event-transport.service';
import { EmailEventService } from '@/services/email-event.service';
import { EmailOutboxService } from '@/services/email-outbox.service';
import { EmailOutboxRepository } from '@/repositories/email-outbox.repository';

test('transport publishes identifier-only events and deterministically schedules/cancels retries', async () => {
  const calls: Array<[string, unknown]> = [];
  const adapter = {
    publish: async (event: unknown) => { calls.push(['publish', event]); },
    schedule: async (name: string, event: unknown, at: Date) => { calls.push([name, { event, at }]); },
    cancel: async (name: string) => { calls.push(['cancel', name]); },
  };
  const transport = new EmailEventTransport(adapter);
  await transport.publish({ kind: 'outbox', outboxId: 'row-1' });
  assert.deepEqual(calls[0], ['publish', { kind: 'outbox', outboxId: 'row-1' }]);
  const event = { kind: 'outbox' as const, outboxId: 'row-1' };
  const date = new Date('2026-10-16T00:00:00Z');
  await transport.schedule(event, date);
  await transport.schedule(event, date);
  assert.equal(calls[1][0], calls[2][0]);
  assert.ok(calls[1][0].length <= 64);
  await assert.rejects(() => transport.publish({ ...event, recipient: 'private@example.test' } as never));
});

test('failed publication/scheduling is not reported as accepted delivery or leaked in errors', async () => {
  const transport = new EmailEventTransport({
    publish: async () => { throw new Error('secret URL'); },
    schedule: async () => { throw new Error('secret URL'); },
    cancel: async () => {},
  });
  await assert.rejects(() => transport.publish({ kind: 'outbox', outboxId: 'x' }), { message: 'EMAIL_EVENT_HANDOFF_FAILED' });
  await assert.rejects(() => transport.schedule({ kind: 'outbox', outboxId: 'x' }, new Date()), { message: 'EMAIL_EVENT_SCHEDULE_FAILED' });
});

test('redelivery repairs a failed retry handoff, while SENT/terminal rows never send again', async () => {
  let state = { status: 'FAILED', nextAttemptAt: new Date(Date.now() + 300_000), lockedAt: null };
  let processed = 0;
  let schedules = 0;
  const service = new EmailEventService(
    { findEventState: async () => state } as never,
    { processOutbox: async () => { processed++; } } as never,
    {} as never,
    new EmailEventTransport({
      publish: async () => {},
      schedule: async () => { if (++schedules === 1) throw new Error('unavailable'); },
      cancel: async () => {},
    }),
  );
  await assert.rejects(() => service.handle({ kind: 'outbox', outboxId: 'row' }));
  await service.handle({ kind: 'outbox', outboxId: 'row' });
  assert.equal(schedules, 2);
  assert.equal(processed, 0);
  state = { ...state, status: 'SENT', nextAttemptAt: null as never };
  await service.handle({ kind: 'outbox', outboxId: 'row' });
  state = { ...state, status: 'FAILED' };
  await service.handle({ kind: 'outbox', outboxId: 'row' });
  assert.equal(processed, 0);
});

test('a non-stale SENDING row keeps its event unacknowledged for crash recovery', async () => {
  const service = new EmailEventService(
    { findEventState: async () => ({ status: 'SENDING', lockedAt: new Date(), nextAttemptAt: null }) } as never,
    { processOutbox: async () => { throw new Error('must not resend live lease'); } } as never,
    {} as never,
    {} as never,
  );
  await assert.rejects(() => service.handle({ kind: 'outbox', outboxId: 'row' }), { message: 'EMAIL_EVENT_LEASE_BUSY' });
});

test('provider retries use 1/5/30 minutes and the fourth failure is terminal, without leaking provider errors', async (t) => {
  const previous = process.env.EMAIL_MODE;
  process.env.EMAIL_MODE = 'console';
  t.after(() => { if (previous === undefined) delete process.env.EMAIL_MODE; else process.env.EMAIL_MODE = previous; });
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 15) });
  let next: Date | null = new Date();
  let attempts = 0;
  const delays: Array<number | null> = [];
  const row = { id: 'row', template: 'WELCOME', payload: {}, recipient: 'qa@example.test', attemptCount: 0, lockedAt: new Date() };
  const worker = new EmailOutboxService({
    claimById: async () => ({ ...row, attemptCount: attempts }),
    markFailed: async (_id: string, reason: string, at: Date | null) => {
      assert.equal(reason, 'EMAIL_DELIVERY_FAILED');
      delays.push(at ? at.getTime() - Date.now() : null);
      next = at; attempts++;
    },
  } as never, { render: () => ({ subject: 'test', html: '', text: '' }) } as never,
  { provider: 'test', send: async () => { throw new Error('token=secret&email=private'); } },
  {} as never, { refresh: async () => {} } as never);
  for (let i = 0; i < 4; i++) {
    await worker.processOutbox('row');
    if (next) t.mock.timers.tick((next as Date).getTime() - Date.now());
  }
  assert.deepEqual(delays, [60000, 300000, 1800000, null]);
});

test('campaign batches continue through durable events beyond 20 recipients, and stale/cancelled events do nothing', async () => {
  const published: Array<Record<string, unknown>> = [];
  const scheduledAt = new Date('2026-01-01T00:00:00Z');
  let status = 'SCHEDULED';
  let dispatched = 0;
  const transport = new EmailEventTransport({
    publish: async (event) => { published.push(event); }, schedule: async () => {}, cancel: async () => {},
  });
  const service = new EmailEventService({
    findEventCandidates: async (_id: string, after?: string) =>
      after ? [{ id: 'row-21' }] : Array.from({ length: 20 }, (_, i) => ({ id: 'row-' + (i + 1) })),
  } as never, {} as never, {
    findById: async () => ({ status, scheduledAt }),
    dispatchDueCampaign: async () => { dispatched++; status = 'SENDING'; },
  } as never, transport);
  const event = { kind: 'campaign' as const, campaignId: 'campaign', scheduledAt: scheduledAt.toISOString() };
  await service.handle(event);
  const continuation = published.pop();
  assert.equal(continuation?.kind, 'campaign');
  assert.equal(continuation?.afterId, 'row-20');
  await service.handle(continuation as never);
  assert.equal(published.filter((e) => e.kind === 'outbox').length, 21);
  const before = dispatched;
  status = 'CANCELLED';
  await service.handle(event);
  status = 'SCHEDULED';
  await service.handle({ ...event, scheduledAt: '2026-01-02T00:00:00.000Z' });
  assert.equal(dispatched, before);
});

test('repository reclaims stale SENDING with a conditional lease and rejects writes from an older worker', async () => {
  const now = new Date();
  let status = 'SENDING';
  let lockedAt = new Date(now.getTime() - 11 * 60_000);
  const oldLease = lockedAt;
  const repository = new EmailOutboxRepository({
    emailOutbox: {
      findFirst: async ({ where }: { where: { OR: Array<{ status: string; lockedAt?: { lte: Date } }> } }) => {
        if (!where.OR.some((item) => item.status === 'SENDING' && item.lockedAt && lockedAt <= item.lockedAt.lte)) return null;
        return { id: 'row', status, lockedAt, attemptCount: 0 };
      },
      updateMany: async ({ where, data }: { where: { status: string; lockedAt?: Date }; data: { status: string; lockedAt: Date } }) => {
        if (where.status !== status || (where.lockedAt && where.lockedAt.getTime() !== lockedAt.getTime())) return { count: 0 };
        status = data.status;
        lockedAt = data.lockedAt;
        return { count: 1 };
      },
    },
  } as never);
  const claimed = await repository.claimById('row', now);
  assert.equal(claimed?.lockedAt.getTime(), now.getTime());
  assert.equal((await repository.markSent('row', 'test', 'message', oldLease)).count, 0);
  assert.equal(status, 'SENDING');
  assert.equal((await repository.markSent('row', 'test', 'message', now)).count, 1);
  assert.equal(status, 'SENT');
});

for (const status of ['SENT', 'SKIPPED', 'FAILED']) {
  test(`redelivery repairs campaign completion after final ${status}, retrying reconciliation failures without resending`, async () => {
    let sends = 0;
    let reconciliations = 0;
    let campaignComplete = false;
    const service = new EmailEventService({
      findEventState: async () => ({ status, nextAttemptAt: null, newsletterCampaignId: 'campaign' }),
    } as never, {
      processOutbox: async () => { sends++; throw new Error('terminal mail must not send again'); },
    } as never, {
      refreshCompletion: async (id: string) => {
        assert.equal(id, 'campaign');
        if (++reconciliations === 1) throw new Error('database temporarily unavailable');
        campaignComplete = true;
      },
    } as never, {} as never);
    const event = { kind: 'outbox' as const, outboxId: 'last-recipient' };
    await assert.rejects(() => service.handle(event), /database temporarily unavailable/);
    await service.handle(event);
    assert.equal(campaignComplete, true);
    assert.equal(reconciliations, 2);
    assert.equal(sends, 0);
  });
}
