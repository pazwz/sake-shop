import assert from 'node:assert/strict';
import test from 'node:test';

test('foreground polling stops when hidden and after unmount', async (t) => {
  const { startAdminInquiryPolling } = await import(
    '@/lib/admin-inquiry-polling'
  );
  t.mock.timers.enable({ apis: ['setInterval'] });
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
  assert.equal(calls, 2);
  visibility.hidden = true;
  visibility.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.tick(90_000);
  assert.equal(calls, 2);
  visibility.hidden = false;
  visibility.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  assert.equal(calls, 3);
  stop();
  events.dispatchEvent(new Event('linxas-admin-inquiry-read'));
  t.mock.timers.tick(90_000);
  assert.equal(calls, 3);
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
