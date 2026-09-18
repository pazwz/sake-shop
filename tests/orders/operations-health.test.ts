import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SyncStatus } from '@prisma/client';
import { OperationsHealthRepository } from '@/repositories/operations-health.repository';
import { OperationsHealthService } from '@/services/operations-health.service';

const now = new Date('2026-09-18T00:00:00.000Z');

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  smaregiRuns: [],
  reservationRuns: [],
  emailRuns: [],
  expiredReservations: 0,
  paymentReviewCount: 0,
  oldestPaymentReviewAt: null,
  email: {
    pending: 0,
    stuckSending: 0,
    terminalTransactionalFailed: 0,
    terminalNewsletterFailed: 0,
  },
  ...overrides,
});

const run = (
  status: SyncStatus,
  minutesAgo: number,
  responsePayload: unknown = {},
) => ({
  status,
  createdAt: new Date(now.getTime() - minutesAgo * 60_000),
  completedAt: new Date(now.getTime() - minutesAgo * 60_000),
  responsePayload,
});

const serviceFor = (value: ReturnType<typeof snapshot>) =>
  new OperationsHealthService({
    getSnapshot: async () => value,
  } as unknown as OperationsHealthRepository);

test('all healthy operations are summarized without raw payloads', async () => {
  const health = await serviceFor(
    snapshot({
      smaregiRuns: [run(SyncStatus.SUCCESS, 5)],
      reservationRuns: [run(SyncStatus.SUCCESS, 2)],
      emailRuns: [run(SyncStatus.SUCCESS, 1)],
    }),
  ).getHealth(now);
  assert.equal(health.smaregiSync.status, 'HEALTHY');
  assert.equal(health.reservationExpiration.status, 'HEALTHY');
  assert.equal(health.emailOutbox.status, 'HEALTHY');
  assert.equal('responsePayload' in health.smaregiSync, false);
});

test('Smaregi warning, stale, and fatal states are separated', async () => {
  const warning = await serviceFor(
    snapshot({
      smaregiRuns: [
        run(SyncStatus.SUCCESS, 5, { outcome: 'SUCCESS_WITH_WARNINGS' }),
      ],
    }),
  ).getHealth(now);
  assert.equal(warning.smaregiSync.status, 'WARNING');

  const stale = await serviceFor(
    snapshot({ smaregiRuns: [run(SyncStatus.SUCCESS, 50)] }),
  ).getHealth(now);
  assert.equal(stale.smaregiSync.status, 'WARNING');

  const failed = await serviceFor(
    snapshot({
      smaregiRuns: [run(SyncStatus.FAILED, 1), run(SyncStatus.SUCCESS, 5)],
    }),
  ).getHealth(now);
  assert.equal(failed.smaregiSync.status, 'CRITICAL');
});

test('reservation worker stale and expired active backlog are visible', async () => {
  const stale = await serviceFor(
    snapshot({ reservationRuns: [run(SyncStatus.SUCCESS, 20)] }),
  ).getHealth(now);
  assert.equal(stale.reservationExpiration.status, 'WARNING');

  const backlog = await serviceFor(
    snapshot({
      reservationRuns: [run(SyncStatus.SUCCESS, 2)],
      expiredReservations: 10,
    }),
  ).getHealth(now);
  assert.equal(backlog.reservationExpiration.status, 'CRITICAL');
  assert.equal(backlog.reservationExpiration.backlogCount, 10);
});

test('email queue differentiates terminal transactional failures from newsletter sync failures', async () => {
  const newsletter = await serviceFor(
    snapshot({
      emailRuns: [run(SyncStatus.SUCCESS, 1)],
      email: {
        pending: 0,
        stuckSending: 0,
        terminalTransactionalFailed: 0,
        terminalNewsletterFailed: 1,
      },
    }),
  ).getHealth(now);
  assert.equal(newsletter.emailOutbox.status, 'WARNING');

  const transactional = await serviceFor(
    snapshot({
      emailRuns: [run(SyncStatus.SUCCESS, 1)],
      email: {
        pending: 0,
        stuckSending: 0,
        terminalTransactionalFailed: 1,
        terminalNewsletterFailed: 0,
      },
    }),
  ).getHealth(now);
  assert.equal(transactional.emailOutbox.status, 'CRITICAL');
});

test('payment requires-review queue is warning and returns to healthy when cleared', async () => {
  const warning = await serviceFor(
    snapshot({ paymentReviewCount: 1, oldestPaymentReviewAt: now }),
  ).getHealth(now);
  assert.equal(warning.paymentReview.status, 'WARNING');
  const recovered = await serviceFor(snapshot()).getHealth(now);
  assert.equal(recovered.paymentReview.status, 'HEALTHY');
});

test('operations health endpoint requires an Admin session and exposes no raw payload DTO', async () => {
  const source = await readFile(
    `${process.cwd()}/app/api/v1/admin/operations/health/route.ts`,
    'utf8',
  );
  assert.match(source, /await requireAdmin\(\)/);
  assert.doesNotMatch(source, /responsePayload/);
  assert.doesNotMatch(source, /recipient/);
});
