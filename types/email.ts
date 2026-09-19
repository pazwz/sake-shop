import type { EmailTemplate } from '@prisma/client';

export type EmailMessage = {
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export interface EmailProviderAdapter {
  readonly provider: string;
  send(message: EmailMessage): Promise<{ messageId: string }>;
}

export type EmailTemplateResult = Pick<
  EmailMessage,
  'subject' | 'html' | 'text'
>;

export type EmailOutboxDraft = {
  eventKey: string;
  type: string;
  recipient: string;
  subject: string;
  template: EmailTemplate;
  payload: Record<string, unknown>;
  newsletterCampaignId?: string;
  newsletterSubscriptionId?: string;
};
