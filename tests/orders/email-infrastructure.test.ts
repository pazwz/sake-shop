import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  EmailOutboxStatus,
  EmailTemplate,
  NewsletterStatus,
} from '@prisma/client';
import { Resend } from 'resend';
import {
  createEmailActionToken,
  hashEmailActionToken,
  isValidEmailActionToken,
} from '@/lib/email-action-token';
import { CustomerAuthService } from '@/services/customer-auth.service';
import { EmailOutboxService } from '@/services/email-outbox.service';

const withEmailMode = async <T>(mode: string, operation: () => Promise<T>) => {
  const previous = process.env.EMAIL_MODE;
  process.env.EMAIL_MODE = mode;
  try {
    return await operation();
  } finally {
    if (previous === undefined)
      Reflect.deleteProperty(process.env, 'EMAIL_MODE');
    else process.env.EMAIL_MODE = previous;
  }
};

test('email action tokens are signed, purpose-bound, and stored as hashes', () => {
  const token = createEmailActionToken(
    'token-record-1',
    'verify-email',
    'test-secret',
  );
  const hash = hashEmailActionToken(token);
  assert.equal(
    isValidEmailActionToken(token, 'verify-email', 'test-secret'),
    true,
  );
  assert.equal(
    isValidEmailActionToken(token, 'reset-password', 'test-secret'),
    false,
  );
  assert.equal(hash.includes(token), false);
  assert.equal(hash.includes('.'), false);
});

test('registration creates a verification hash and does not persist the raw token', async () => {
  let captured: Record<string, unknown> | undefined;
  const auth = new CustomerAuthService({
    registerPendingVerification: async (input: Record<string, unknown>) => {
      captured = input;
      return {
        id: 'customer-1',
        name: 'Buyer',
        email: 'buyer@example.com',
        phone: null,
        emailVerifiedAt: null,
      };
    },
  } as never);
  await auth.register({
    name: 'Buyer',
    email: 'buyer@example.com',
    password: 'long-password',
  });
  const verification = captured?.verification as Record<string, unknown>;
  assert.equal(typeof verification.tokenHash, 'string');
  assert.equal(String(verification.tokenHash).includes('.'), false);
  assert.equal(captured?.marketing, undefined);
});

test('valid verification and reset tokens are passed to repositories only as hashes', async () => {
  const verificationToken = createEmailActionToken(
    'verification-1',
    'verify-email',
  );
  const resetToken = createEmailActionToken('reset-1', 'reset-password');
  const hashes: string[] = [];
  const auth = new CustomerAuthService({
    verifyEmailAndCreateSession: async (input: { tokenHash: string }) => {
      const tokenHash = input.tokenHash;
      hashes.push(tokenHash);
      return { customer: { id: 'customer-1' } };
    },
    resetPassword: async (tokenHash: string) => {
      hashes.push(tokenHash);
      return { reset: true };
    },
  } as never);
  assert.equal((await auth.verifyEmail(verificationToken)).verified, true);
  assert.deepEqual(await auth.resetPassword(resetToken, 'new-password-123'), {
    reset: true,
  });
  assert.deepEqual(hashes, [
    hashEmailActionToken(verificationToken),
    hashEmailActionToken(resetToken),
  ]);
});

test('expired verification and reset tokens are rejected without leaking internals', async () => {
  const auth = new CustomerAuthService({
    verifyEmailAndCreateSession: async () => null,
    resetPassword: async () => null,
  } as never);
  await assert.rejects(
    () => auth.verifyEmail(createEmailActionToken('expired-v', 'verify-email')),
    /無効または期限切れ/,
  );
  await assert.rejects(
    () =>
      auth.resetPassword(
        createEmailActionToken('expired-r', 'reset-password'),
        'new-password-123',
      ),
    /無効または期限切れ/,
  );
});

const outboxRow = {
  id: 'outbox-1',
  eventKey: 'order-received:order-1',
  type: 'ORDER_CREATED',
  recipient: 'buyer@example.com',
  subject: 'subject',
  template: EmailTemplate.ORDER_RECEIVED,
  payload: { orderNumber: 'ORDER-1' },
  status: EmailOutboxStatus.PENDING,
  attemptCount: 0,
  nextAttemptAt: new Date(),
  lockedAt: null,
  provider: null,
  providerMessageId: null,
  deliveryStatus: null,
  lastError: null,
  createdAt: new Date(),
  sentAt: null,
  deliveredAt: null,
  updatedAt: new Date(),
};

test('outbox send success marks SENT with a stable idempotency key', async () => {
  const marked: Array<unknown[]> = [];
  const sentKeys: string[] = [];
  const service = new EmailOutboxService(
    {
      claimDue: async () => [outboxRow],
      markSent: async (...input: unknown[]) => marked.push(input),
    } as never,
    {
      render: () => ({ subject: 'subject', html: '<p>mail</p>', text: 'mail' }),
    } as never,
    {
      provider: 'test',
      send: async (message) => {
        sentKeys.push(message.idempotencyKey);
        return { messageId: 'message-1' };
      },
    },
    {} as never,
  );
  const result = await withEmailMode('console', () => service.processDue());
  assert.deepEqual(result, {
    outcome: 'SUCCESS',
    processed: 1,
    sent: 1,
    failed: 0,
  });
  assert.deepEqual(sentKeys, ['email-outbox:outbox-1']);
  assert.deepEqual(marked[0], ['outbox-1', 'test', 'message-1']);
});

test('outbox failure schedules a bounded retry and never fails business data', async () => {
  const failures: Array<unknown[]> = [];
  const service = new EmailOutboxService(
    {
      claimDue: async () => [outboxRow],
      markFailed: async (...input: unknown[]) => failures.push(input),
    } as never,
    {
      render: () => ({ subject: 'subject', html: '<p>mail</p>', text: 'mail' }),
    } as never,
    {
      provider: 'test',
      send: async () => {
        throw new Error('provider unavailable');
      },
    },
    {} as never,
  );
  const result = await withEmailMode('console', () => service.processDue());
  assert.equal(result.outcome, 'SUCCESS_WITH_WARNINGS');
  assert.equal(result.failed, 1);
  assert.equal(failures.length, 1);
  assert.equal(failures[0][0], 'outbox-1');
  assert.ok(failures[0][2] instanceof Date);
});

test('outbox claim idempotency prevents a duplicate provider send', async () => {
  let claims = 0;
  let sends = 0;
  const service = new EmailOutboxService(
    {
      claimDue: async () => (claims++ === 0 ? [outboxRow] : []),
      markSent: async () => undefined,
    } as never,
    {
      render: () => ({ subject: 'subject', html: '<p>mail</p>', text: 'mail' }),
    } as never,
    {
      provider: 'test',
      send: async () => {
        sends += 1;
        return { messageId: 'message-1' };
      },
    },
    {} as never,
  );
  await withEmailMode('console', () => service.processDue());
  await withEmailMode('console', () => service.processDue());
  assert.equal(sends, 1);
});

test('production without email configuration fails closed', async () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldVercelEnv = process.env.VERCEL_ENV;
  const oldMode = process.env.EMAIL_MODE;
  Object.assign(process.env, {
    NODE_ENV: 'production',
    VERCEL_ENV: 'production',
  });
  Reflect.deleteProperty(process.env, 'EMAIL_MODE');
  let claimed = false;
  try {
    const result = await new EmailOutboxService(
      { claimDue: async () => (claimed = true) } as never,
      {} as never,
      null,
      {} as never,
    ).processDue();
    assert.equal(result.outcome, 'DISABLED');
    assert.equal(claimed, false);
  } finally {
    if (oldNodeEnv === undefined)
      Reflect.deleteProperty(process.env, 'NODE_ENV');
    else Object.assign(process.env, { NODE_ENV: oldNodeEnv });
    if (oldVercelEnv === undefined)
      Reflect.deleteProperty(process.env, 'VERCEL_ENV');
    else process.env.VERCEL_ENV = oldVercelEnv;
    if (oldMode === undefined)
      Reflect.deleteProperty(process.env, 'EMAIL_MODE');
    else process.env.EMAIL_MODE = oldMode;
  }
});

test('transactional payloads exclude payment metadata, reservations, and Smaregi data', async () => {
  const template = await readFile(
    `${process.cwd()}/services/email-template.service.ts`,
    'utf8',
  );
  const orderRepository = await readFile(
    `${process.cwd()}/repositories/inventory-reservation.repository.ts`,
    'utf8',
  );
  assert.equal(template.includes('paymentMetadata'), false);
  assert.equal(template.includes('InventoryReservation'), false);
  assert.equal(template.includes('Smaregi'), false);
  assert.ok(orderRepository.includes('ORDER_RECEIVED'));
});

test('password reset transaction revokes every active customer session', async () => {
  const source = await readFile(
    `${process.cwd()}/repositories/customer.repository.ts`,
    'utf8',
  );
  assert.match(source, /customerSession\.updateMany/);
  assert.match(source, /customerId: token\.customerId, revokedAt: null/);
});

test('webhook severe delivery events suppress marketing without deleting Customer', async () => {
  const source = await readFile(
    `${process.cwd()}/repositories/email-outbox.repository.ts`,
    'utf8',
  );
  assert.ok(source.includes("'email.bounced'"));
  assert.ok(source.includes("'email.complained'"));
  assert.ok(source.includes("'email.suppressed'"));
  assert.ok(source.includes('NewsletterStatus.SUPPRESSED'));
  assert.equal(source.includes('customer.delete'), false);
  assert.equal(NewsletterStatus.SUPPRESSED, 'SUPPRESSED');
});

test('email worker is protected, bounded, Node-only, and exposes no provider secret', async () => {
  const route = await readFile(
    `${process.cwd()}/app/api/v1/internal/email/process/route.ts`,
    'utf8',
  );
  const worker = await readFile(
    `${process.cwd()}/services/email-outbox.service.ts`,
    'utf8',
  );
  const adapter = await readFile(
    `${process.cwd()}/services/email-adapters/resend-email.adapter.ts`,
    'utf8',
  );
  assert.ok(route.includes('assertCronAuthorization'));
  assert.ok(route.includes("runtime = 'nodejs'"));
  assert.ok(worker.includes('EMAIL_PROCESS_BATCH_SIZE'));
  assert.ok(adapter.includes('process.env.RESEND_API_KEY'));
  assert.equal(adapter.includes('NEXT_PUBLIC_RESEND'), false);
});

test('email Lambda logs counts only and never logs authorization material', async () => {
  const source = await readFile(
    `${process.cwd()}/infrastructure/aws/email-outbox-trigger/index.mjs`,
    'utf8',
  );
  assert.ok(source.includes('WithDecryption: true'));
  assert.ok(source.includes("method: 'POST'"));
  assert.equal(source.includes('console.log(secret)'), false);
  assert.equal(source.includes('console.log(endpoint)'), false);
  assert.equal(source.includes('Authorization: payload'), false);
});

test('Resend webhook verification rejects invalid signatures and accepts a valid signed event', () => {
  const key = randomBytes(32);
  const secret = `whsec_${key.toString('base64')}`;
  const id = 'webhook-event-1';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = JSON.stringify({
    type: 'email.delivered',
    created_at: new Date().toISOString(),
    data: {
      created_at: new Date().toISOString(),
      email_id: 'email-1',
      from: 'LINXAS <no-reply@example.com>',
      to: ['buyer@example.com'],
      subject: 'Delivered',
    },
  });
  const signature = `v1,${createHmac('sha256', key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64')}`;
  const resend = new Resend('test-key');
  assert.equal(
    resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    }).type,
    'email.delivered',
  );
  assert.throws(() =>
    resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature: 'v1,invalid' },
      webhookSecret: secret,
    }),
  );
});
