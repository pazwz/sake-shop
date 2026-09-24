import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ContactInquiryStatus, EmailTemplate } from '@prisma/client';
import { ForbiddenError } from '@/lib/errors';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { EmailTemplateService } from '@/services/email-template.service';
import { EmailOutboxService } from '@/services/email-outbox.service';
import {
  customerInquiryCreateValidator,
  customerInquiryMessageValidator,
} from '@/validators/contact-inquiry.validator';

test('order-message validators accept only their strict customer payloads', () => {
  assert.equal(
    customerInquiryCreateValidator.safeParse({
      message: '確認をお願いします。',
    }).success,
    true,
  );
  assert.equal(
    customerInquiryMessageValidator.safeParse({ body: '追加のご連絡です。' })
      .success,
    true,
  );
  assert.equal(
    customerInquiryCreateValidator.safeParse({
      message: '確認をお願いします。',
      customerId: 'another-customer',
    }).success,
    false,
  );
  assert.equal(
    customerInquiryMessageValidator.safeParse({
      body: '追加のご連絡です。',
      status: ContactInquiryStatus.CLOSED,
    }).success,
    false,
  );
});

test('an order-support message is triggered only after its durable outbox write', async () => {
  const sequence: string[] = [];
  const service = new ContactInquiryService(
    {
      startOrAddCustomerMessage: async () => {
        sequence.push('outbox-committed');
        return { inquiryId: 'inquiry-1', outboxId: 'outbox-1', created: true };
      },
    } as never,
    {
      trigger: async () => {
        sequence.push('triggered');
        return { triggered: false, reason: 'TRIGGER_FAILED' };
      },
    } as never,
  );
  const result = await service.startOrderSupport(
    'order-1',
    '本文です。',
    'customer-1',
  );
  assert.equal(result.inquiryId, 'inquiry-1');
  assert.deepEqual(sequence, ['outbox-committed', 'triggered']);
});

test('a customer cannot load or append a message for another customers order', async () => {
  const service = new ContactInquiryService({
    findOwnedOrder: async () => null,
    findOrderIdForCustomerInquiry: async () => null,
  } as never);
  await assert.rejects(
    () => service.getForCustomer('order-other', 'customer-1'),
    ForbiddenError,
  );
  await assert.rejects(
    () =>
      service.addCustomerMessage('inquiry-other', '本文です。', 'customer-1'),
    ForbiddenError,
  );
});

test('an existing order thread reuses its owned order through the normal message path', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = new ContactInquiryService({
    findOrderIdForCustomerInquiry: async () => ({ orderId: 'order-1' }),
    startOrAddCustomerMessage: async (input: Record<string, unknown>) => {
      calls.push(input);
      return { inquiryId: 'inquiry-1', outboxId: null, created: false };
    },
  } as never);
  await service.addCustomerMessage(
    'inquiry-1',
    '再開をお願いします。',
    'customer-1',
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].orderId, 'order-1');
  assert.equal(calls[0].customerId, 'customer-1');
});

test('order message notification does not disclose message content or accept email replies', () => {
  const secretMessage = '管理者だけの本文です。';
  const rendered = new EmailTemplateService().render(
    EmailTemplate.ORDER_MESSAGE_NOTIFICATION,
    {
      customerName: 'お客様',
      orderNumber: 'LINXAS-20260924-ABC123',
      body: secretMessage,
      internalNote: '非公開メモ',
    },
  );
  assert.match(rendered.html, /LINXAS-20260924-ABC123/);
  assert.match(rendered.html, /メッセージを確認する/);
  assert.equal(rendered.html.includes(secretMessage), false);
  assert.equal(rendered.html.includes('非公開メモ'), false);
  assert.match(rendered.text, /送信専用/);
});

test('order message notifications suppress a provider default Reply-To', async () => {
  const messages: Array<Record<string, unknown>> = [];
  const service = new EmailOutboxService(
    {
      claimDue: async () => [
        {
          id: 'outbox-1',
          recipient: 'customer@example.com',
          template: EmailTemplate.ORDER_MESSAGE_NOTIFICATION,
          payload: { orderNumber: 'LINXAS-20260924-ABC123' },
          attemptCount: 0,
        },
      ],
      markSent: async () => undefined,
    } as never,
    new EmailTemplateService(),
    {
      provider: 'test',
      send: async (message: Record<string, unknown>) => {
        messages.push(message);
        return { messageId: 'message-1' };
      },
    } as never,
    {} as never,
    {
      dispatchDue: async () => undefined,
      refresh: async () => undefined,
    } as never,
  );
  const previous = process.env.EMAIL_MODE;
  process.env.EMAIL_MODE = 'console';
  try {
    await service.processDue();
  } finally {
    if (previous === undefined)
      Reflect.deleteProperty(process.env, 'EMAIL_MODE');
    else process.env.EMAIL_MODE = previous;
  }
  assert.equal(messages.length, 1);
  assert.equal(messages[0].suppressReplyTo, true);
});

test('public contact is a non-mutating support guide and disabled endpoint', async () => {
  const [page, route] = await Promise.all([
    readFile(`${process.cwd()}/app/contact/page.tsx`, 'utf8'),
    readFile(`${process.cwd()}/app/api/v1/contact/route.ts`, 'utf8'),
  ]);
  assert.match(page, /お問い合わせについて/);
  assert.equal(page.includes('<form'), false);
  assert.match(route, /CONTACT_DISABLED/);
  assert.match(route, /410/);
  assert.equal(route.includes('ContactInquiryService'), false);
});
