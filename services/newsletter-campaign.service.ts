import { randomUUID } from 'node:crypto';
import { EmailTemplate, NewsletterCampaignStatus } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { EmailOutboxRepository } from '@/repositories/email-outbox.repository';
import {
  NewsletterCampaignRepository,
  type StoredNewsletterCampaign,
} from '@/repositories/newsletter-campaign.repository';
import type {
  NewsletterCampaignAdminDto,
  NewsletterCampaignContent,
  NewsletterCampaignDetailDto,
} from '@/types/newsletter-campaign';
import type {
  NewsletterCampaignCreateInput,
  NewsletterCampaignUpdateInput,
} from '@/validators/newsletter-campaign.validator';

const toDto = async (
  repository: NewsletterCampaignRepository,
  campaign: StoredNewsletterCampaign,
): Promise<NewsletterCampaignAdminDto> => {
  const counts = await repository.getOutboxCounts(campaign.id);
  return {
    ...campaign,
    metrics: {
      target: counts.target,
      pending: counts.PENDING,
      sending: counts.SENDING,
      sent: counts.SENT,
      delivered: counts.delivered,
      failed: counts.FAILED,
      skipped: counts.SKIPPED,
    },
  };
};

const editableContent = (
  input: NewsletterCampaignCreateInput | NewsletterCampaignUpdateInput,
) => input as Partial<NewsletterCampaignContent>;

const auditSnapshot = (campaign: StoredNewsletterCampaign) => ({
  subject: campaign.subject,
  status: campaign.status,
  scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
  startedAt: campaign.startedAt?.toISOString() ?? null,
  completedAt: campaign.completedAt?.toISOString() ?? null,
});

export class NewsletterCampaignService {
  public constructor(
    private readonly campaigns = new NewsletterCampaignRepository(),
    private readonly outbox = new EmailOutboxRepository(),
  ) {}

  public async list() {
    return Promise.all(
      (await this.campaigns.findAll()).map((campaign) =>
        toDto(this.campaigns, campaign),
      ),
    );
  }

  public async get(id: string) {
    const campaign = await this.campaigns.findById(id);
    if (!campaign) throw new NotFoundError('ニュースレターが見つかりません。');
    const [dto, audits] = await Promise.all([
      toDto(this.campaigns, campaign),
      this.campaigns.findAuditEntries(id),
    ]);
    return {
      ...dto,
      audits: audits.map((audit) => ({
        action: audit.action,
        createdAt: audit.createdAt,
        actorName: audit.adminUser.name,
      })),
    } satisfies NewsletterCampaignDetailDto;
  }

  public async create(input: NewsletterCampaignCreateInput, adminId: string) {
    const campaign = await this.campaigns.create({
      ...(editableContent(input) as NewsletterCampaignContent),
      adminId,
    });
    await this.campaigns.recordAudit({
      adminUserId: adminId,
      action: 'NEWSLETTER_CAMPAIGN_CREATED',
      campaignId: campaign.id,
      afterData: auditSnapshot(campaign),
    });
    return toDto(this.campaigns, campaign);
  }

  public async update(
    id: string,
    input: NewsletterCampaignUpdateInput,
    adminId: string,
  ) {
    if (!Object.keys(input).length)
      throw new ValidationError('変更内容を入力してください。');
    const existing = await this.campaigns.findById(id);
    if (!existing) throw new NotFoundError('ニュースレターが見つかりません。');
    const nextCtaLabel = input.ctaLabel ?? existing.ctaLabel;
    const nextCtaUrl = input.ctaUrl ?? existing.ctaUrl;
    if (Boolean(nextCtaLabel) !== Boolean(nextCtaUrl))
      throw new ValidationError('CTA文言とリンク先は両方入力してください。');
    const campaign = await this.campaigns.updateEditable(
      id,
      editableContent(input),
      adminId,
    );
    if (!campaign)
      throw new ConflictError('配信開始後のニュースレターは編集できません。');
    await this.campaigns.recordAudit({
      adminUserId: adminId,
      action: 'NEWSLETTER_CAMPAIGN_UPDATED',
      campaignId: campaign.id,
      beforeData: auditSnapshot(existing),
      afterData: auditSnapshot(campaign),
    });
    return toDto(this.campaigns, campaign);
  }

  public async currentRecipientEstimate() {
    return this.campaigns.countSubscribedRecipients();
  }

  public async schedule(id: string, scheduledAt: Date, adminId: string) {
    if (scheduledAt.getTime() <= Date.now())
      throw new ValidationError(
        '配信日時は現在より後の日時を指定してください。',
      );
    return this.scheduleAt(id, scheduledAt, adminId);
  }

  public async sendNow(id: string, adminId: string) {
    return this.scheduleAt(id, new Date(), adminId);
  }

  private async scheduleAt(id: string, scheduledAt: Date, adminId: string) {
    if ((await this.currentRecipientEstimate()) === 0)
      throw new ValidationError('配信対象者がいません。');
    const existing = await this.campaigns.findById(id);
    const campaign = await this.campaigns.schedule(id, scheduledAt, adminId);
    if (!campaign)
      throw new ConflictError('配信開始後のニュースレターは変更できません。');
    await this.campaigns.recordAudit({
      adminUserId: adminId,
      action: 'NEWSLETTER_CAMPAIGN_SCHEDULED',
      campaignId: campaign.id,
      ...(existing ? { beforeData: auditSnapshot(existing) } : {}),
      afterData: auditSnapshot(campaign),
    });
    return toDto(this.campaigns, campaign);
  }

  public async cancel(id: string, adminId: string) {
    const existing = await this.campaigns.findById(id);
    const campaign = await this.campaigns.cancel(id, adminId);
    if (!campaign)
      throw new ConflictError(
        '配信開始後のニュースレターはキャンセルできません。',
      );
    await this.campaigns.recordAudit({
      adminUserId: adminId,
      action: 'NEWSLETTER_CAMPAIGN_CANCELLED',
      campaignId: campaign.id,
      ...(existing ? { beforeData: auditSnapshot(existing) } : {}),
      afterData: auditSnapshot(campaign),
    });
    return toDto(this.campaigns, campaign);
  }

  public async queueTest(id: string, adminEmail: string, adminId: string) {
    const campaign = await this.campaigns.findById(id);
    if (!campaign) throw new NotFoundError('ニュースレターが見つかりません。');
    await this.outbox.enqueue({
      eventKey: `newsletter-campaign-test:${campaign.id}:${randomUUID()}`,
      type: 'NEWSLETTER_CAMPAIGN_TEST',
      recipient: adminEmail,
      subject: `【テスト】${campaign.subject}`,
      template: EmailTemplate.NEWSLETTER_CAMPAIGN,
      payload: {
        subject: campaign.subject,
        preheader: campaign.preheader,
        headline: campaign.headline,
        heroImageUrl: campaign.heroImageUrl,
        heroImageAlt: campaign.heroImageAlt,
        body: campaign.body,
        ctaLabel: campaign.ctaLabel,
        ctaUrl: campaign.ctaUrl,
        testMode: true,
      },
    });
    await this.campaigns.recordAudit({
      adminUserId: adminId,
      action: 'NEWSLETTER_CAMPAIGN_TEST_QUEUED',
      campaignId: campaign.id,
      afterData: auditSnapshot(campaign),
    });
    return { queued: true };
  }
}

export class NewsletterCampaignDispatchService {
  public constructor(
    private readonly campaigns = new NewsletterCampaignRepository(),
  ) {}

  public async dispatchDue(now = new Date()) {
    const due = await this.campaigns.findDueIds(now);
    let dispatched = 0;
    let recipients = 0;
    for (const { id } of due) {
      const result = await this.campaigns.dispatchDueCampaign(id, now);
      if (result.state !== 'DISPATCHED') continue;
      dispatched += 1;
      recipients += result.recipients;
    }
    return { dispatched, recipients };
  }

  public async shouldSend(newsletterSubscriptionId: string | null) {
    if (!newsletterSubscriptionId) return true;
    return Boolean(
      await this.campaigns.isRecipientSubscribed(newsletterSubscriptionId),
    );
  }

  public async refresh(campaignIds: Iterable<string>) {
    const uniqueIds = [...new Set(campaignIds)];
    await Promise.all(
      uniqueIds.map((id) => this.campaigns.refreshCompletion(id)),
    );
  }
}
