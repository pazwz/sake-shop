import type { NewsletterCampaignStatus } from '@prisma/client';

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

export type NewsletterCampaignDetailDto = NewsletterCampaignAdminDto & {
  audits: NewsletterCampaignAuditEntry[];
};
