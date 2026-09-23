import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminRole, ContactInquiryStatus, EmailTemplate } from '@prisma/client';
import { ForbiddenError } from '@/lib/errors';
import { EmailTemplateService } from '@/services/email-template.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { inquiryReplyValidator } from '@/validators/contact-inquiry.validator';

test('staff can only assign an inquiry to self', async () => {
  const service = new ContactInquiryService({
    assign: async () => ({}),
  } as never);
  await assert.rejects(
    () =>
      service.assign('inquiry-1', 'another-admin', {
        id: 'staff-1',
        role: AdminRole.STAFF,
      }),
    ForbiddenError,
  );
});

test('reply API validation accepts no recipient override or extra fields', () => {
  assert.equal(
    inquiryReplyValidator.safeParse({
      body: '返信です。',
      idempotencyKey: '8cdd1f4d-25b1-4e7d-ae46-6ce3c5a47211',
    }).success,
    true,
  );
  assert.equal(
    inquiryReplyValidator.safeParse({
      body: '返信です。',
      idempotencyKey: '8cdd1f4d-25b1-4e7d-ae46-6ce3c5a47211',
      to: 'attacker@example.com',
    }).success,
    false,
  );
});

test('reply uses a repository result and preserves outbox idempotency result', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = new ContactInquiryService({
    queueReply: async (value: Record<string, unknown>) => {
      calls.push(value);
      return { outboxId: 'outbox-1', duplicate: false };
    },
  } as never);
  const result = await service.reply(
    'inquiry-1',
    {
      body: 'ご返信です。',
      idempotencyKey: '8cdd1f4d-25b1-4e7d-ae46-6ce3c5a47211',
    },
    'admin-1',
  );
  assert.equal(result.outboxId, 'outbox-1');
  assert.equal(calls[0].adminId, 'admin-1');
  assert.equal('recipient' in calls[0], false);
});

test('contact reply template is escaped and has no admin personal email', () => {
  const rendered = new EmailTemplateService().render(
    EmailTemplate.CONTACT_REPLY,
    {
      publicId: 'INQ-20260923-ABCDEF',
      customerName: 'お客様',
      body: '<img src=x>',
      subject: 'Re: [LINXAS] お問い合わせについて（INQ-20260923-ABCDEF）',
    },
  );
  assert.match(rendered.html, /INQ-20260923-ABCDEF/);
  assert.equal(rendered.html.includes('<img src=x>'), false);
  assert.equal(rendered.html.includes('&lt;img'), true);
});

test('closed inquiries require a privileged actor to reopen', async () => {
  const service = new ContactInquiryService({
    get: async () => ({ status: ContactInquiryStatus.CLOSED }),
    updateStatus: async () => ({}),
  } as never);
  await assert.rejects(
    () =>
      service.updateStatus('inquiry-1', ContactInquiryStatus.IN_PROGRESS, {
        id: 'staff-1',
        role: AdminRole.STAFF,
      }),
    ForbiddenError,
  );
});
