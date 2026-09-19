import type {
  EmailOutboxStatus,
  NewsletterCampaignStatus,
} from '@prisma/client';

export type NewsletterCampaignContent = {
  subject: string;
  preheader: string | null;
  headline: string;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type NewsletterCampaignSectionContent = {
  imageUrl: string | null;
  imageAlt: string | null;
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type NewsletterCampaignSectionDto = NewsletterCampaignSectionContent & {
  id: string;
  sortOrder: number;
};

export type NewsletterCampaignMetrics = {
  target: number;
  pending: number;
  sending: number;
  sent: number;
  delivered: number;
  failed: number;
  skipped: number;
};

export type NewsletterCampaignAdminDto = NewsletterCampaignContent & {
  id: string;
  status: NewsletterCampaignStatus;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  resultSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
  metrics: NewsletterCampaignMetrics;
};

export type NewsletterCampaignAuditEntry = {
  action: string;
  createdAt: Date;
  actorName: string;
};

export type NewsletterCampaignTestSendDto = {
  recipient: string;
  status: EmailOutboxStatus;
  queuedAt: Date;
  sentAt: Date | null;
};

export type NewsletterCampaignDetailDto = NewsletterCampaignAdminDto & {
  audits: NewsletterCampaignAuditEntry[];
  lastTestSend: NewsletterCampaignTestSendDto | null;
  sections: NewsletterCampaignSectionDto[];
};
