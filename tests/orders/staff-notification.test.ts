import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailTemplate } from '@prisma/client';
import { EmailTemplateService } from '@/services/email-template.service';
import { ContactInquiryRepository } from '@/repositories/contact-inquiry.repository';

test('staff notification escapes bounded summary and links to the actual authenticated Admin thread', () => {
  const rendered = new EmailTemplateService().render(EmailTemplate.CONTACT_INQUIRY, {
    inquiryId: 'inquiry-1', orderNumber: 'ORDER-1',
    customerName: '<Alice>', customerEmail: 'qa@example.test',
    subject: '注文について', category: 'ご注文', summary: '<script>unsafe</script>' + 'x'.repeat(1000),
    createdAt: '2026-10-15T00:00:00.000Z',
  });
  assert.match(rendered.html, /&lt;Alice&gt;/);
  assert.match(rendered.html, /qa@example.test/);
  assert.match(rendered.html, /&lt;script&gt;/);
  assert.doesNotMatch(rendered.html, /<script>/);
  assert.match(rendered.text, /\/admin\/inquiries\/inquiry-1/);
  assert.doesNotMatch(rendered.text, /x{501}/);
  assert.match(rendered.text, /2026-10-15/);
});

test('customer message transaction enqueues only a bounded internal summary with server-owned identity', async () => {
  let draft: Record<string, unknown> | undefined;
  const repository = new ContactInquiryRepository({
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) => operation({
      order: { findFirst: async () => ({ id: 'order', orderNumber: 'ORDER-1', customer: { name: 'Buyer', email: 'qa@example.test' } }) },
      contactInquiry: { upsert: async () => ({ id: 'thread', publicId: 'PUBLIC', status: 'NEW' }), update: async () => ({}) },
      contactInquiryMessage: { create: async () => ({ id: 'message' }), update: async () => ({}) },
      emailOutbox: { create: async ({ data }: { data: Record<string, unknown> }) => { draft = data; return { id: 'mail' }; } },
    }),
  } as never);
  await repository.startOrAddCustomerMessage({
    orderId: 'order', customerId: 'customer', publicId: 'PUBLIC', submissionId: 'submission',
    body: 'x'.repeat(1000), adminNotificationRecipient: 'staff@example.test',
  });
  const payload = draft?.payload as Record<string, unknown>;
  assert.equal(draft?.recipient, 'staff@example.test');
  assert.equal(payload.customerEmail, 'qa@example.test');
  assert.equal(payload.inquiryId, 'thread');
  assert.equal(String(payload.summary).length, 500);
  assert.equal('body' in payload, false);
});
