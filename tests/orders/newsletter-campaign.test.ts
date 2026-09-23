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
import { EmailTemplateService } from '@/services/email-template.service';
import {
  NewsletterCampaignDispatchService,
  NewsletterCampaignService,
} from '@/services/newsletter-campaign.service';
import { NewsletterCampaignRepository } from '@/repositories/newsletter-campaign.repository';
import {
  newsletterCampaignCreateValidator,
  newsletterCampaignSectionsValidator,
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

test('dynamic sections accept all supported content shapes and reject invalid content', () => {
  const valid = [
    { imageUrl: 'https://cdn.example.com/one.jpg' },
    { headline: '見出し', body: '本文' },
    { headline: '見出しのみ' },
    { body: '本文', ctaLabel: '商品を見る', ctaUrl: '/products' },
  ];
  assert.equal(
    newsletterCampaignSectionsValidator.safeParse({ sections: valid }).success,
    true,
  );
  assert.equal(
    newsletterCampaignSectionsValidator.safeParse({ sections: [{}] }).success,
    false,
  );
  assert.equal(
    newsletterCampaignSectionsValidator.safeParse({
      sections: [{ ctaLabel: '商品を見る' }],
    }).success,
    false,
  );
  assert.equal(
    newsletterCampaignSectionsValidator.safeParse({
      sections: [{ ctaUrl: '/products' }],
    }).success,
    false,
  );
  assert.equal(
    newsletterCampaignSectionsValidator.safeParse({
      sections: [{ ctaLabel: '危険', ctaUrl: 'javascript:alert(1)' }],
    }).success,
    false,
  );
  assert.equal(
    newsletterCampaignSectionsValidator.safeParse({
      sections: Array.from({ length: 21 }, () => ({ body: '本文' })),
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
  const triggered: string[] = [];
  const service = new NewsletterCampaignService(
    {
      findById: async () => campaign,
      listSections: async () => [],
      recordAudit: async (input: Record<string, unknown>) => {
        auditInput = input;
      },
    } as never,
    {
      enqueue: async (draft: Record<string, unknown>) => {
        drafts.push(draft);
        return { id: 'outbox-test-1' };
      },
    } as never,
    {
      trigger: async (outboxId?: string) => {
        triggered.push(outboxId ?? '');
        return { triggered: true, reason: null };
      },
    } as never,
  );
  await service.queueTest(campaign.id, 'recipient@example.com', 'admin-1');
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].recipient, 'recipient@example.com');
  assert.equal(drafts[0].template, EmailTemplate.NEWSLETTER_CAMPAIGN);
  assert.match(String(drafts[0].subject), /^【テスト】/);
  assert.deepEqual(triggered, ['outbox-test-1']);
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
    sections: [],
    testMode: true,
  });
  assert.ok(auditInput);
  assert.equal(
    JSON.stringify(auditInput).includes('recipient@example.com'),
    false,
  );
});

test('test sends preserve the saved hero image without mutating the campaign', async () => {
  const drafts: Array<Record<string, unknown>> = [];
  const campaignWithImage = {
    ...campaign,
    heroImageUrl: 'https://cdn.example.com/newsletter-hero.jpg',
    heroImageAlt: 'ニュースレター画像',
  };
  const service = new NewsletterCampaignService(
    {
      findById: async () => campaignWithImage,
      listSections: async () => [],
      recordAudit: async () => undefined,
    } as never,
    {
      enqueue: async (draft: Record<string, unknown>) => drafts.push(draft),
    } as never,
  );

  await service.queueTest(campaign.id, 'recipient@example.com', 'admin-1');

  assert.equal(
    (drafts[0].payload as Record<string, unknown>).heroImageUrl,
    campaignWithImage.heroImageUrl,
  );
  assert.equal(campaignWithImage.status, NewsletterCampaignStatus.DRAFT);
});

test('newsletter footer includes compliant formal links but no unsubscribe link in test mail', () => {
  const templates = new EmailTemplateService();
  const common = {
    subject: campaign.subject,
    headline: campaign.headline,
    body: campaign.body,
  };
  const formal = templates.render(EmailTemplate.NEWSLETTER_CAMPAIGN, {
    ...common,
    newsletterSubscriptionId: 'subscription-1',
  });
  const testMail = templates.render(EmailTemplate.NEWSLETTER_CAMPAIGN, {
    ...common,
    testMode: true,
  });

  assert.match(formal.html, /LINXAS \/ リンクサス福岡/);
  assert.match(formal.html, /お問い合わせ/);
  assert.match(formal.html, /プライバシーポリシー/);
  assert.match(formal.html, /特定商取引法に基づく表記/);
  assert.match(formal.html, /newsletter\/unsubscribe\?token=/);
  assert.match(formal.html, /配信停止はこちら/);
  assert.match(
    formal.html,
    /このメールは、LINXASのニュースレター配信にご登録いただいたお客さまへお送りしています。/,
  );
  assert.equal(
    formal.html.match(/20歳未満の者の飲酒は法律で禁止されています。/g)?.length,
    1,
  );
  assert.match(testMail.html, /これはテストメールです/);
  assert.match(
    testMail.html,
    /このテストメールには有効な配信停止リンクは含まれていません。/,
  );
  assert.equal(
    testMail.html.match(/20歳未満の者の飲酒は法律で禁止されています。/g)?.length,
    1,
  );
  assert.doesNotMatch(testMail.html, /newsletter\/unsubscribe\?token=/);
  assert.doesNotMatch(testMail.html, /配信停止はこちら<\/a>/);
});

test('copy as draft preserves saved content while creating a distinct DRAFT', async () => {
  let createInput: Record<string, unknown> | null = null;
  let auditInput: Record<string, unknown> | null = null;
  const service = new NewsletterCampaignService({
    findById: async () => campaign,
    listSections: async () => [],
    createWithSections: async (input: Record<string, unknown>) => {
      createInput = input;
      return {
        ...campaign,
        id: 'campaign-copy',
        subject: String(input.subject),
        status: NewsletterCampaignStatus.DRAFT,
      };
    },
    recordAudit: async (input: Record<string, unknown>) => {
      auditInput = input;
    },
    getOutboxCounts: async () => metrics,
  } as never);

  const copied = await service.copyAsDraft(campaign.id, 'admin-1');

  assert.ok(createInput);
  const copyData = createInput as Record<string, unknown>;
  assert.equal(copyData.heroImageUrl, campaign.heroImageUrl);
  assert.match(String(copyData.subject), /（コピー）$/);
  assert.equal(copied.status, NewsletterCampaignStatus.DRAFT);
  assert.ok(auditInput);
  assert.equal(
    (auditInput as Record<string, unknown>).action,
    'NEWSLETTER_CAMPAIGN_COPIED',
  );
});

test('copy as draft creates new section rows while preserving section content and order', async () => {
  let copiedSections: Array<Record<string, unknown>> = [];
  const sourceSections = [
    {
      id: 'section-source-one',
      sortOrder: 0,
      imageUrl: 'https://cdn.example.com/one.jpg',
      imageAlt: '一枚目',
      headline: '一つ目',
      body: '本文一',
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: 'section-source-two',
      sortOrder: 1,
      imageUrl: null,
      imageAlt: null,
      headline: null,
      body: '本文二',
      ctaLabel: '見る',
      ctaUrl: '/products',
    },
  ];
  const service = new NewsletterCampaignService({
    findById: async () => campaign,
    listSections: async () => sourceSections,
    createWithSections: async (
      input: Record<string, unknown>,
      sections: Array<Record<string, unknown>>,
    ) => {
      copiedSections = sections;
      return {
        ...campaign,
        id: 'campaign-copy-with-sections',
        subject: String(input.subject),
      };
    },
    getOutboxCounts: async () => metrics,
    recordAudit: async () => undefined,
  } as never);

  await service.copyAsDraft(campaign.id, 'admin-1');

  assert.deepEqual(copiedSections, [
    {
      imageUrl: 'https://cdn.example.com/one.jpg',
      imageAlt: '一枚目',
      headline: '一つ目',
      body: '本文一',
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      imageUrl: null,
      imageAlt: null,
      headline: null,
      body: '本文二',
      ctaLabel: '見る',
      ctaUrl: '/products',
    },
  ]);
  assert.equal('id' in copiedSections[0], false);
});

test('test send snapshots dynamic sections in their saved order', async () => {
  const drafts: Array<Record<string, unknown>> = [];
  const sections = [
    {
      id: 'section-1',
      sortOrder: 0,
      imageUrl: null,
      imageAlt: null,
      headline: '最初',
      body: '一つ目',
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      id: 'section-2',
      sortOrder: 1,
      imageUrl: 'https://cdn.example.com/two.jpg',
      imageAlt: '二つ目',
      headline: null,
      body: null,
      ctaLabel: null,
      ctaUrl: null,
    },
  ];
  const service = new NewsletterCampaignService(
    {
      findById: async () => campaign,
      listSections: async () => sections,
      recordAudit: async () => undefined,
    } as never,
    { enqueue: async (draft: Record<string, unknown>) => drafts.push(draft) } as never,
  );

  await service.queueTest(campaign.id, 'recipient@example.com', 'admin-1');

  assert.deepEqual((drafts[0].payload as Record<string, unknown>).sections, [
    {
      imageUrl: null,
      imageAlt: null,
      headline: '最初',
      body: '一つ目',
      ctaLabel: null,
      ctaUrl: null,
    },
    {
      imageUrl: 'https://cdn.example.com/two.jpg',
      imageAlt: '二つ目',
      headline: null,
      body: null,
      ctaLabel: null,
      ctaUrl: null,
    },
  ]);
});

test('section rendering preserves order and omits empty markup', () => {
  const templates = new EmailTemplateService();
  const rendered = templates.render(EmailTemplate.NEWSLETTER_CAMPAIGN, {
    subject: campaign.subject,
    headline: campaign.headline,
    body: campaign.body,
    sections: [
      { headline: '先頭', body: '本文A' },
      { imageUrl: 'https://cdn.example.com/second.jpg', imageAlt: '二番目' },
    ],
    testMode: true,
  });
  assert.ok(rendered.html.indexOf('先頭') < rendered.html.indexOf('second.jpg'));
  assert.match(rendered.html, /本文A/);
  assert.doesNotMatch(rendered.html, /undefined/);
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

test('formal dispatch implementation snapshots sorted sections before creating Outbox rows', async () => {
  const repository = await readFile(
    `${process.cwd()}/repositories/newsletter-campaign.repository.ts`,
    'utf8',
  );
  assert.match(repository, /const sections = await repository\.listSections\(campaign\.id\)/);
  assert.match(repository, /sections: sections\.map/);
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
