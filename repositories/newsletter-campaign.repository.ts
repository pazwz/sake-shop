import {
  EmailOutboxStatus,
  EmailTemplate,
  NewsletterCampaignStatus,
  NewsletterStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { NewsletterCampaignContent } from '@/types/newsletter-campaign';

type Database = PrismaClient | Prisma.TransactionClient;

const campaignSelect = {
  id: true,
  subject: true,
  preheader: true,
  headline: true,
  heroImageUrl: true,
  heroImageAlt: true,
  body: true,
  ctaLabel: true,
  ctaUrl: true,
  status: true,
  scheduledAt: true,
  startedAt: true,
  completedAt: true,
  resultSummary: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NewsletterCampaignSelect;

export type StoredNewsletterCampaign = Prisma.NewsletterCampaignGetPayload<{
  select: typeof campaignSelect;
}>;

export type CampaignOutboxCounts = Record<EmailOutboxStatus, number> & {
  delivered: number;
  target: number;
};

type CampaignAuditSnapshot = {
  subject: string;
  status: NewsletterCampaignStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

const emptyCounts = (): CampaignOutboxCounts => ({
  PENDING: 0,
  SENDING: 0,
  SENT: 0,
  FAILED: 0,
  SKIPPED: 0,
  delivered: 0,
  target: 0,
});

export class NewsletterCampaignRepository {
  public constructor(private readonly database: Database = prisma) {}

  public findAll() {
    return this.database.newsletterCampaign.findMany({
      select: campaignSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  public findById(id: string) {
    return this.database.newsletterCampaign.findUnique({
      where: { id },
      select: campaignSelect,
    });
  }

  public create(input: NewsletterCampaignContent & { adminId: string }) {
    const { adminId, ...content } = input;
    return this.database.newsletterCampaign.create({
      data: {
        ...content,
        createdByAdminId: adminId,
        updatedByAdminId: adminId,
      },
      select: campaignSelect,
    });
  }

  public async updateEditable(
    id: string,
    input: Partial<NewsletterCampaignContent>,
    adminId: string,
  ) {
    const updated = await this.database.newsletterCampaign.updateMany({
      where: {
        id,
        status: {
          in: [
            NewsletterCampaignStatus.DRAFT,
            NewsletterCampaignStatus.SCHEDULED,
          ],
        },
        startedAt: null,
      },
      data: { ...input, updatedByAdminId: adminId },
    });
    if (updated.count !== 1) return null;
    return this.findById(id);
  }

  public async schedule(id: string, scheduledAt: Date, adminId: string) {
    const updated = await this.database.newsletterCampaign.updateMany({
      where: {
        id,
        status: {
          in: [
            NewsletterCampaignStatus.DRAFT,
            NewsletterCampaignStatus.SCHEDULED,
          ],
        },
        startedAt: null,
      },
      data: {
        status: NewsletterCampaignStatus.SCHEDULED,
        scheduledAt,
        completedAt: null,
        resultSummary: null,
        updatedByAdminId: adminId,
      },
    });
    if (updated.count !== 1) return null;
    return this.findById(id);
  }

  public async cancel(id: string, adminId: string) {
    const updated = await this.database.newsletterCampaign.updateMany({
      where: {
        id,
        status: {
          in: [
            NewsletterCampaignStatus.DRAFT,
            NewsletterCampaignStatus.SCHEDULED,
          ],
        },
        startedAt: null,
      },
      data: {
        status: NewsletterCampaignStatus.CANCELLED,
        completedAt: new Date(),
        resultSummary: '配信開始前にキャンセルされました。',
        updatedByAdminId: adminId,
      },
    });
    if (updated.count !== 1) return null;
    return this.findById(id);
  }

  public async claimDue(id: string, now: Date) {
    const claimed = await this.database.newsletterCampaign.updateMany({
      where: {
        id,
        status: NewsletterCampaignStatus.SCHEDULED,
        scheduledAt: { lte: now },
        startedAt: null,
      },
      data: {
        status: NewsletterCampaignStatus.SENDING,
        startedAt: now,
      },
    });
    if (claimed.count !== 1) return null;
    return this.findById(id);
  }

  public findDueIds(now: Date) {
    return this.database.newsletterCampaign.findMany({
      where: {
        status: NewsletterCampaignStatus.SCHEDULED,
        scheduledAt: { lte: now },
        startedAt: null,
      },
      select: { id: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Claims a due campaign and snapshots the current subscribed audience in one
   * transaction. A process crash can therefore never leave a campaign marked
   * SENDING without its corresponding outbox rows.
   */
  public async dispatchDueCampaign(id: string, now: Date) {
    return prisma.$transaction(async (tx) => {
      const repository = new NewsletterCampaignRepository(tx);
      const campaign = await repository.claimDue(id, now);
      if (!campaign) return { state: 'NOT_CLAIMED' as const, recipients: 0 };

      const recipients = await repository.findSubscribedRecipients();
      if (!recipients.length) {
        await repository.markCancelledWithoutRecipients(id, now);
        return { state: 'NO_RECIPIENTS' as const, recipients: 0 };
      }

      const inserted = await repository.enqueueRecipients(campaign, recipients);
      return {
        state: 'DISPATCHED' as const,
        recipients: inserted.count,
      };
    });
  }

  public findSubscribedRecipients() {
    return this.database.newsletterSubscription.findMany({
      where: { status: NewsletterStatus.SUBSCRIBED },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  public countSubscribedRecipients() {
    return this.database.newsletterSubscription.count({
      where: { status: NewsletterStatus.SUBSCRIBED },
    });
  }

  public recordAudit(input: {
    adminUserId: string;
    action: string;
    campaignId: string;
    beforeData?: CampaignAuditSnapshot;
    afterData?: CampaignAuditSnapshot;
  }) {
    return this.database.auditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        entityType: 'NewsletterCampaign',
        entityId: input.campaignId,
        beforeData: input.beforeData as Prisma.InputJsonValue | undefined,
        afterData: input.afterData as Prisma.InputJsonValue | undefined,
      },
    });
  }

  public findAuditEntries(campaignId: string) {
    return this.database.auditLog.findMany({
      where: { entityType: 'NewsletterCampaign', entityId: campaignId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        action: true,
        createdAt: true,
        adminUser: { select: { name: true } },
      },
    });
  }

  public enqueueRecipients(
    campaign: StoredNewsletterCampaign,
    recipients: Array<{ id: string; email: string }>,
  ) {
    if (!recipients.length) return Promise.resolve({ count: 0 });
    const payload = {
      subject: campaign.subject,
      preheader: campaign.preheader,
      headline: campaign.headline,
      heroImageUrl: campaign.heroImageUrl,
      heroImageAlt: campaign.heroImageAlt,
      body: campaign.body,
      ctaLabel: campaign.ctaLabel,
      ctaUrl: campaign.ctaUrl,
      testMode: false,
    };
    return this.database.emailOutbox.createMany({
      data: recipients.map((recipient) => ({
        eventKey: `newsletter-campaign:${campaign.id}:${recipient.id}`,
        type: 'NEWSLETTER_CAMPAIGN',
        recipient: recipient.email,
        subject: campaign.subject,
        template: EmailTemplate.NEWSLETTER_CAMPAIGN,
        payload,
        newsletterCampaignId: campaign.id,
        newsletterSubscriptionId: recipient.id,
      })),
      skipDuplicates: true,
    });
  }

  public isRecipientSubscribed(newsletterSubscriptionId: string) {
    return this.database.newsletterSubscription.findFirst({
      where: {
        id: newsletterSubscriptionId,
        status: NewsletterStatus.SUBSCRIBED,
      },
      select: { id: true },
    });
  }

  public async getOutboxCounts(
    campaignId: string,
  ): Promise<CampaignOutboxCounts> {
    const [byStatus, delivered, target] = await Promise.all([
      this.database.emailOutbox.groupBy({
        by: ['status'],
        where: { newsletterCampaignId: campaignId },
        _count: { _all: true },
      }),
      this.database.emailOutbox.count({
        where: { newsletterCampaignId: campaignId, deliveredAt: { not: null } },
      }),
      this.database.emailOutbox.count({
        where: { newsletterCampaignId: campaignId },
      }),
    ]);
    const counts = emptyCounts();
    for (const item of byStatus) counts[item.status] = item._count._all;
    counts.delivered = delivered;
    counts.target = target;
    return counts;
  }

  public async refreshCompletion(campaignId: string, now = new Date()) {
    const campaign = await this.findById(campaignId);
    if (!campaign || campaign.status !== NewsletterCampaignStatus.SENDING)
      return campaign;
    const counts = await this.getOutboxCounts(campaignId);
    if (!counts.target) return campaign;
    const outstanding = counts.PENDING + counts.SENDING;
    const retrying = await this.database.emailOutbox.count({
      where: {
        newsletterCampaignId: campaignId,
        status: EmailOutboxStatus.FAILED,
        nextAttemptAt: { not: null },
      },
    });
    if (outstanding || retrying) return campaign;
    const status =
      counts.FAILED === counts.target
        ? NewsletterCampaignStatus.FAILED
        : counts.FAILED > 0
          ? NewsletterCampaignStatus.PARTIAL_FAILED
          : NewsletterCampaignStatus.SENT;
    await this.database.newsletterCampaign.updateMany({
      where: { id: campaignId, status: NewsletterCampaignStatus.SENDING },
      data: { status, completedAt: now },
    });
    return this.findById(campaignId);
  }

  public markCancelledWithoutRecipients(id: string, now: Date) {
    return this.database.newsletterCampaign.updateMany({
      where: { id, status: NewsletterCampaignStatus.SENDING },
      data: {
        status: NewsletterCampaignStatus.CANCELLED,
        completedAt: now,
        resultSummary: '配信開始時点で対象者が0件でした。',
      },
    });
  }
}
