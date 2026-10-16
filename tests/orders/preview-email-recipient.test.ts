import assert from 'node:assert/strict';
import test from 'node:test';
import { Resend } from 'resend';
import { ResendEmailAdapter } from '@/services/email-adapters/resend-email.adapter';

const message = {
  to: 'pazwz@yahoo.co.jp',
  subject: 'Preview E2E',
  html: '<p>Preview E2E</p>',
  text: 'Preview E2E',
  idempotencyKey: 'preview-recipient-test',
};

test('Preview rejects other recipients before contacting Resend and logs no address', async (context) => {
  const calls: unknown[] = [];
  const errors: unknown[] = [];
  context.mock.method(Resend.prototype, 'post', async () => {
    calls.push('provider');
    return { data: { id: 'offline' }, error: null };
  });
  context.mock.method(console, 'error', (...args: unknown[]) =>
    errors.push(args),
  );
  const adapter = new ResendEmailAdapter(
    'offline',
    'preview@example.test',
    undefined,
    {
      VERCEL_ENV: 'preview',
      PREVIEW_EMAIL_ALLOWED_RECIPIENT: 'pazwz@yahoo.co.jp',
    },
  );
  await assert.rejects(
    adapter.send({ ...message, to: 'not-allowed@example.test' }),
    /PREVIEW_EMAIL_RECIPIENT_REJECTED/,
  );
  assert.equal(calls.length, 0);
  assert.deepEqual(errors, [['PREVIEW_EMAIL_RECIPIENT_REJECTED']]);
});

test('Preview fails closed when the recipient allowlist is missing', async (context) => {
  context.mock.method(console, 'error', () => undefined);
  context.mock.method(Resend.prototype, 'post', async () => ({
    data: { id: 'offline' },
    error: null,
  }));
  const adapter = new ResendEmailAdapter(
    'offline',
    'preview@example.test',
    undefined,
    { VERCEL_ENV: 'preview' },
  );
  await assert.rejects(
    adapter.send(message),
    /PREVIEW_EMAIL_RECIPIENT_REJECTED/,
  );
});

test('Preview sends only the explicitly allowed recipient without rewriting it', async (context) => {
  const recipients: unknown[] = [];
  context.mock.method(
    Resend.prototype,
    'post',
    async (_path: string, body: Record<string, unknown>) => {
      recipients.push(body.to);
      return { data: { id: 'offline' }, error: null };
    },
  );
  const adapter = new ResendEmailAdapter(
    'offline',
    'preview@example.test',
    undefined,
    {
      VERCEL_ENV: 'preview',
      PREVIEW_EMAIL_ALLOWED_RECIPIENT: 'pazwz@yahoo.co.jp',
    },
  );
  assert.deepEqual(await adapter.send(message), { messageId: 'offline' });
  assert.deepEqual(recipients, ['pazwz@yahoo.co.jp']);
});

test('Production sending does not inherit Preview-only recipient restrictions', async (context) => {
  context.mock.method(Resend.prototype, 'post', async () => ({
    data: { id: 'offline' },
    error: null,
  }));
  const adapter = new ResendEmailAdapter(
    'offline',
    'preview@example.test',
    undefined,
    {
      VERCEL_ENV: 'production',
      PREVIEW_EMAIL_ALLOWED_RECIPIENT: 'pazwz@yahoo.co.jp',
    },
  );
  assert.deepEqual(
    await adapter.send({ ...message, to: 'offline@example.test' }),
    { messageId: 'offline' },
  );
});
