import assert from 'node:assert/strict';
import test from 'node:test';

test('event refresh has no interval, stops when hidden and after unmount', async (t) => {
  const { startAdminInquiryPolling } = await import(
    '@/lib/admin-inquiry-polling'
  );
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
  const visibility = Object.assign(new EventTarget(), { hidden: false });
  const events = new EventTarget();
  let calls = 0;
  const stop = startAdminInquiryPolling(
    async () => {
      calls++;
    },
    visibility as never,
    events as never,
  );
  await Promise.resolve();
  assert.equal(calls, 1);
  t.mock.timers.tick(30_000);
  await Promise.resolve();
  assert.equal(calls, 1);
  visibility.hidden = true;
  visibility.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(90_000);
  assert.equal(calls, 1);
  visibility.hidden = false;
  visibility.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  assert.equal(calls, 2);
  stop();
  events.dispatchEvent(new Event('linxas-admin-inquiry-read'));
  t.mock.timers.tick(90_000);
  assert.equal(calls, 2);
});

test('15-minute idle suppresses automatic refresh; first interaction resumes once', async (t) => {
  const { startAdminInquiryPolling } = await import('@/lib/admin-inquiry-polling');
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  const visibility = Object.assign(new EventTarget(), { hidden: false });
  const events = new EventTarget();
  let calls = 0;
  const stop = startAdminInquiryPolling(async () => { calls++; }, visibility as never, events as never);
  await Promise.resolve();
  t.mock.timers.tick(15 * 60_000);
  visibility.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  assert.equal(calls, 1);
  events.dispatchEvent(new Event('keydown'));
  await Promise.resolve();
  assert.equal(calls, 2);
  events.dispatchEvent(new Event('pointerdown'));
  await Promise.resolve();
  assert.equal(calls, 2);
  stop();
});

test('read refresh queues behind an in-flight summary instead of losing the event', async () => {
  const { startAdminInquiryPolling } = await import(
    '@/lib/admin-inquiry-polling'
  );
  const visibility = Object.assign(new EventTarget(), { hidden: false });
  const events = new EventTarget();
  let calls = 0;
  let resolve!: () => void;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  const stop = startAdminInquiryPolling(
    async () => {
      calls++;
      if (calls === 1) await pending;
    },
    visibility as never,
    events as never,
  );
  try {
    events.dispatchEvent(new Event('linxas-admin-inquiry-read'));
    assert.equal(calls, 1);
    resolve();
    await pending;
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(calls, 2);
  } finally {
    stop();
  }
});
