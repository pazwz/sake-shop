import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  EmailOutboxStatus,
  EmailTemplate,
  AdminRole,
  NewsletterCampaignStatus,
} from '@prisma/client';
import { cmsAdminRoles } from '@/services/admin-authorization.service';
import { EmailOutboxService } from '@/services/email-outbox.service';
import {
  NewsletterCampaignDispatchService,
  NewsletterCampaignService,
} from '@/services/newsletter-campaign.service';
import { NewsletterCampaignRepository } from '@/repositories/newsletter-campaign.repository';
import {
  newsletterCampaignCreateValidator,
  newsletterCampaignTestValidator,
} from '@/validators/newsletter-campaign.validator';

const campaign = {
  id: 'campaign-1',
  subject: '秋のおすすめ',
  preheader: null,
  headline: '秋の一本',
  heroImageUrl: null,
  heroImageAlt: null,
  body: '季節のおすすめをご紹介します。',
  ctaLabel: '商品を見る',
  ctaUrl: '/products',
  status: NewsletterCampaignStatus.DRAFT,
  scheduledAt: null,
  startedAt: null,
  completedAt: null,
  resultSummary: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const metrics = {
  PENDING: 0,
  SENDING: 0,
  SENT: 0,
  FAILED: 0,
  SKIPPED: 0,
  delivered: 0,
  target: 0,
};

test('campaign content requires a CTA label and URL together', () => {
  const base = {
    subject: campaign.subject,
    headline: campaign.headline,
    body: campaign.body,
  };
  assert.equal(
    newsletterCampaignCreateValidator.safeParse({
      ...base,
      ctaLabel: '商品を見る',
    }).success,
    false,
  );
  assert.equal(
    newsletterCampaignCreateValidator.safeParse({
      ...base,
      ctaLabel: '商品を見る',
      ctaUrl: '/products',
    }).success,
    true,
  );
});

test('test-send recipient accepts only a strict, validated email body', () => {
  assert.equal(
    newsletterCampaignTestValidator.safeParse({
      email: '  test@example.com  ',
    }).success,
    true,
  );
  assert.equal(
    newsletterCampaignTestValidator.safeParse({ email: 'not-an-email' }).success,
    false,
  );
  assert.equal(
    newsletterCampaignTestValidator.safeParse({
      email: 'test@example.com',
      adminId: 'forged-admin',
    }).success,
    false,
  );
});

test('test-send permission is restricted to OWNER and MANAGER', () => {
  assert.deepEqual(cmsAdminRoles, [AdminRole.OWNER, AdminRole.MANAGER]);
  assert.equal((cmsAdminRoles as AdminRole[]).includes(AdminRole.STAFF), false);
});

test('campaign repository never passes internal adminId to Prisma create data', async () => {
  let createData: Record<string, unknown> | null = null;
  const repository = new NewsletterCampaignRepository({
    newsletterCampaign: {
      create: async (args: { data: Record<string, unknown> }) => {
        createData = args.data;
        return campaign;
      },
    },
  } as never);

  await repository.create({
    subject: campaign.subject,
    preheader: campaign.preheader,
    headline: campaign.headline,
    heroImageUrl: campaign.heroImageUrl,
    heroImageAlt: campaign.heroImageAlt,
    body: campaign.body,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    adminId: 'admin-1',
  });

  assert.ok(createData);
  const data = createData as Record<string, unknown>;
  assert.equal(data.subject, campaign.subject);
  assert.equal(data.headline, campaign.headline);
  assert.equal(data.body, campaign.body);
  assert.equal(data.createdByAdminId, 'admin-1');
  assert.equal(data.updatedByAdminId, 'admin-1');
  assert.equal('adminId' in data, false);
});

test('send now schedules through the worker and never calls a provider inline', async () => {
  let scheduledAt: Date | null = null;
  const service = new NewsletterCampaignService(
    {
      countSubscribedRecipients: async () => 2,
      schedule: async (_id: string, value: Date) => {
        scheduledAt = value;
        return {
          ...campaign,
          status: NewsletterCampaignStatus.SCHEDULED,
          scheduledAt: value,
        };
      },
      getOutboxCounts: async () => metrics,
      findById: async () => campaign,
      recordAudit: async () => undefined,
    } as never,
    {} as never,
  );
  const result = await service.sendNow(campaign.id, 'admin-1');
  assert.equal(result.status, NewsletterCampaignStatus.SCHEDULED);
  assert.ok(scheduledAt !== null);
  assert.equal(typeof (scheduledAt as Date).getTime, 'function');
});

test('test send queues exactly one validated recipient row without changing campaign state', async () => {
  const drafts: Array<Record<string, unknown>> = [];
  let auditInput: Record<string, unknown> | null = null;
  const service = new NewsletterCampaignService(
    {
      findById: async () => campaign,
      recordAudit: async (input: Record<string, unknown>) => {
        auditInput = input;
      },
    } as never,
    {
      enqueue: async (draft: Record<string, unknown>) => drafts.push(draft),
    } as never,
  );
  await service.queueTest(campaign.id, 'recipient@example.com', 'admin-1');
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].recipient, 'recipient@example.com');
  assert.equal(drafts[0].template, EmailTemplate.NEWSLETTER_CAMPAIGN);
  assert.match(String(drafts[0].subject), /^【テスト】/);
  assert.equal(drafts[0].newsletterCampaignId, undefined);
  assert.equal(drafts[0].newsletterSubscriptionId, undefined);
  assert.deepEqual(drafts[0].payload, {
    subject: campaign.subject,
    preheader: campaign.preheader,
    headline: campaign.headline,
    heroImageUrl: campaign.heroImageUrl,
    heroImageAlt: campaign.heroImageAlt,
    body: campaign.body,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
    testMode: true,
  });
  assert.ok(auditInput);
  assert.equal(
    JSON.stringify(auditInput).includes('recipient@example.com'),
    false,
  );
});

test('dispatch snapshots recipients through the repository atomic dispatch boundary', async () => {
  let dispatched = 0;
  const service = new NewsletterCampaignDispatchService({
    findDueIds: async () => [{ id: campaign.id }],
    dispatchDueCampaign: async () => {
      dispatched += 1;
      return { state: 'DISPATCHED' as const, recipients: 3 };
    },
  } as never);
  assert.deepEqual(await service.dispatchDue(new Date()), {
    dispatched: 1,
    recipients: 3,
  });
  assert.equal(dispatched, 1);
});

test('unsubscribed recipients are skipped before any provider send', async () => {
  let providerSends = 0;
  let skipped = 0;
  const service = new EmailOutboxService(
    {
      claimDue: async () => [
        {
          id: 'outbox-campaign-1',
          recipient: 'subscriber@example.com',
          template: EmailTemplate.NEWSLETTER_CAMPAIGN,
          payload: {},
          attemptCount: 0,
          newsletterSubscriptionId: 'subscription-1',
          newsletterCampaignId: campaign.id,
        },
      ],
      markSkipped: async () => {
        skipped += 1;
      },
    } as never,
    {} as never,
    {
      provider: 'test',
      send: async () => {
        providerSends += 1;
        return { messageId: 'should-not-send' };
      },
    },
    {} as never,
    {
      dispatchDue: async () => ({ dispatched: 0, recipients: 0 }),
      shouldSend: async () => false,
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
  assert.equal(skipped, 1);
  assert.equal(providerSends, 0);
});

test('campaign migration and worker keep marketing failures separate from transactional failures', async () => {
  const [schema, repository, health] = await Promise.all([
    readFile(`${process.cwd()}/prisma/schema.prisma`, 'utf8'),
    readFile(
      `${process.cwd()}/repositories/newsletter-campaign.repository.ts`,
      'utf8',
    ),
    readFile(`${process.cwd()}/services/operations-health.service.ts`, 'utf8'),
  ]);
  assert.match(schema, /model NewsletterCampaign/);
  assert.match(schema, /NEWSLETTER_CAMPAIGN/);
  assert.match(schema, /SKIPPED/);
  assert.match(repository, /prisma\.\$transaction/);
  assert.match(health, /terminalNewsletterCampaignFailed/);
});
