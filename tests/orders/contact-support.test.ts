import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { EmailTemplate } from '@prisma/client';
import { AppError } from '@/lib/errors';
import { ContactRepository } from '@/repositories/contact.repository';
import { ContactService } from '@/services/contact.service';
import { EmailOutboxService } from '@/services/email-outbox.service';
import { EmailTemplateService } from '@/services/email-template.service';
import { contactSubmitValidator } from '@/validators/contact.validator';

const input = (overrides: Record<string, unknown> = {}) =>
  contactSubmitValidator.parse({
    submissionId: '8cdd1f4d-25b1-4e7d-ae46-6ce3c5a47211',
    topic: 'PRODUCT',
    email: 'BUYER@EXAMPLE.COM',
    message: '商品について教えてください。',
    website: '',
    ...overrides,
  });

const withRecipient = async <T>(operation: () => Promise<T>) => {
  const previous = process.env.CONTACT_RECIPIENT_EMAIL;
  process.env.CONTACT_RECIPIENT_EMAIL = 'support@example.com';
  try {
    return await operation();
  } finally {
    if (previous === undefined)
      Reflect.deleteProperty(process.env, 'CONTACT_RECIPIENT_EMAIL');
    else process.env.CONTACT_RECIPIENT_EMAIL = previous;
  }
};

test('anonymous contact creates only one durable support outbox draft', async () => {
  const drafts: Array<Record<string, unknown>> = [];
  const service = new ContactService({
    enqueueSupportInquiry: async (draft: Record<string, unknown>) => {
      drafts.push(draft);
    },
  } as never);
  const result = await withRecipient(() => service.submit(input()));
  assert.equal(result.accepted, true);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].recipient, 'support@example.com');
  assert.equal(drafts[0].email, 'buyer@example.com');
  assert.equal(drafts[0].orderReferenceStatus, 'NOT_PROVIDED');
  assert.equal(drafts[0].customerId, undefined);
});

test('owned order references are internal-only while foreign references remain unverified', async () => {
  const drafts: Array<Record<string, unknown>> = [];
  const service = new ContactService({
    hasOrderForCustomerReference: async (customerId: string) =>
      customerId === 'customer-owned',
    enqueueSupportInquiry: async (draft: Record<string, unknown>) => {
      drafts.push(draft);
    },
  } as never);
  await withRecipient(async () => {
    await service.submit(input({ orderNumber: 'LINXAS-20260918-ABC123' }), 'customer-owned');
    await service.submit(
      input({
        submissionId: 'd7cce02c-923e-497f-9a53-24317a8e8f74',
        orderNumber: 'LINXAS-20260918-OTHER',
      }),
      'customer-foreign',
    );
  });
  assert.equal(drafts[0].orderReferenceStatus, 'VERIFIED');
  assert.equal(drafts[1].orderReferenceStatus, 'UNVERIFIED');
});

test('honeypot submissions do not persist or send an email', async () => {
  let writes = 0;
  const service = new ContactService({
    enqueueSupportInquiry: async () => {
      writes += 1;
    },
  } as never);
  const result = await service.submit(input({ website: 'https://spam.invalid' }));
  assert.deepEqual(result, { accepted: true });
  assert.equal(writes, 0);
});

test('contact fails closed when the support recipient is not configured', async () => {
  const previous = process.env.CONTACT_RECIPIENT_EMAIL;
  Reflect.deleteProperty(process.env, 'CONTACT_RECIPIENT_EMAIL');
  try {
    await assert.rejects(
      () => new ContactService({} as never).submit(input()),
      (error: unknown) =>
        error instanceof AppError && error.code === 'CONTACT_UNAVAILABLE',
    );
  } finally {
    if (previous !== undefined)
      process.env.CONTACT_RECIPIENT_EMAIL = previous;
  }
});

test('contact validation rejects unsafe and malformed public input', () => {
  assert.equal(contactSubmitValidator.safeParse({ ...input(), email: 'invalid' }).success, false);
  assert.equal(contactSubmitValidator.safeParse({ ...input(), message: '' }).success, false);
  assert.equal(contactSubmitValidator.safeParse({ ...input(), message: 'x'.repeat(5001) }).success, false);
  assert.equal(contactSubmitValidator.safeParse({ ...input(), topic: 'arbitrary subject' }).success, false);
  assert.equal(contactSubmitValidator.safeParse({ ...input(), orderNumber: 'ORDER\r\nBcc:test@example.com' }).success, false);
  assert.equal(contactSubmitValidator.safeParse({ ...input(), recipient: 'attacker@example.com' }).success, false);
});

test('contact repository uses a stable event key and cannot take recipient from client input', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const repository = new ContactRepository({
    emailOutbox: {
      upsert: async (value: Record<string, unknown>) => {
        calls.push(value);
        return value;
      },
    },
  } as never);
  await repository.enqueueSupportInquiry({
    submissionId: '8cdd1f4d-25b1-4e7d-ae46-6ce3c5a47211',
    recipient: 'support@example.com',
    email: 'buyer@example.com',
    topic: 'PRODUCT',
    topicLabel: '商品について',
    message: 'message',
    orderReferenceStatus: 'NOT_PROVIDED',
    submittedAt: new Date('2026-09-18T00:00:00.000Z'),
  });
  assert.equal(
    (calls[0].where as { eventKey: string }).eventKey,
    'contact:8cdd1f4d-25b1-4e7d-ae46-6ce3c5a47211:support',
  );
  const create = calls[0].create as { recipient: string; payload: Record<string, unknown> };
  assert.equal(create.recipient, 'support@example.com');
  assert.equal('recipient' in create.payload, false);
});

test('contact email escapes user content and sends it only as Reply-To', async () => {
  const rendered = new EmailTemplateService().render(EmailTemplate.CONTACT_INQUIRY, {
    topic: 'PRODUCT',
    topicLabel: '商品について',
    email: 'buyer@example.com',
    message: '<img src=x onerror=alert(1)>',
    orderReferenceStatus: 'UNVERIFIED',
    loggedIn: false,
    submittedAt: '2026-09-18T00:00:00.000Z',
  });
  assert.equal(rendered.html.includes('<img src=x'), false);
  assert.equal(rendered.html.includes('&lt;img'), true);

  const messages: Array<{ to: string; replyTo?: string }> = [];
  const service = new EmailOutboxService(
    {
      claimDue: async () => [
        {
          id: 'contact-outbox-1',
          recipient: 'support@example.com',
          template: EmailTemplate.CONTACT_INQUIRY,
          payload: { email: 'buyer@example.com' },
          attemptCount: 0,
        },
      ],
      markSent: async () => undefined,
    } as never,
    { render: () => rendered } as never,
    {
      provider: 'test',
      send: async (message) => {
        messages.push(message);
        return { messageId: 'support-message-1' };
      },
    },
    {} as never,
  );
  const previous = process.env.EMAIL_MODE;
  process.env.EMAIL_MODE = 'console';
  try {
    await service.processDue();
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, 'EMAIL_MODE');
    else process.env.EMAIL_MODE = previous;
  }
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, 'support@example.com');
  assert.equal(messages[0].replyTo, 'buyer@example.com');
});

test('contact route retains same-origin, validation, and optional-session boundaries', async () => {
  const route = await readFile(
    `${process.cwd()}/app/api/v1/contact/route.ts`,
    'utf8',
  );
  assert.match(route, /assertSameOriginMutation/);
  assert.match(route, /contactSubmitValidator/);
  assert.match(route, /getCurrentCustomer/);
  assert.match(route, /canAttemptCustomerAuth\('contact'/);
});
