import type { NewsletterCampaignStatus } from '@prisma/client';

export const MAX_NEWSLETTER_SECTIONS = 20;

export const NEWSLETTER_CAMPAIGN_STATUS_LABELS: Record<
  NewsletterCampaignStatus,
  string
> = {
  DRAFT: '下書き',
  SCHEDULED: '予約済み',
  SENDING: '送信中',
  SENT: '送信済み',
  PARTIAL_FAILED: '一部失敗',
  FAILED: '失敗',
  CANCELLED: 'キャンセル済み',
};

export const NEWSLETTER_CAMPAIGN_MUTATION_ROLES = ['OWNER', 'MANAGER'] as const;

export const NEWSLETTER_CAMPAIGN_AUDIT_LABELS: Record<string, string> = {
  NEWSLETTER_CAMPAIGN_CREATED: '作成',
  NEWSLETTER_CAMPAIGN_UPDATED: '編集',
  NEWSLETTER_CAMPAIGN_TEST_QUEUED: 'テスト送信をキューに追加',
  NEWSLETTER_CAMPAIGN_SECTIONS_UPDATED: '追加コンテンツを更新',
  NEWSLETTER_CAMPAIGN_COPIED: '下書きを複製',
  NEWSLETTER_CAMPAIGN_SCHEDULED: '配信予約を設定',
  NEWSLETTER_CAMPAIGN_CANCELLED: '配信予約をキャンセル',
};
