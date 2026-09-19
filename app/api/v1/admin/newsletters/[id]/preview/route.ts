import { ZodError } from 'zod';
import { EmailTemplate } from '@prisma/client';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { EmailTemplateService } from '@/services/email-template.service';
import { requireAdmin } from '@/services/admin-authorization.service';
import { NewsletterCampaignService } from '@/services/newsletter-campaign.service';
import type { NewsletterCampaignDetailDto } from '@/types/newsletter-campaign';
import { newsletterCampaignCreateValidator } from '@/validators/newsletter-campaign.validator';

const templates = new EmailTemplateService();
const campaigns = new NewsletterCampaignService();

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin();
    const id = (await params).id;
    const input = id === 'draft'
      ? newsletterCampaignCreateValidator.parse(await request.json())
      : await campaigns.get(id);
    const sections =
      id === 'draft' ? [] : (input as NewsletterCampaignDetailDto).sections;
    const rendered = templates.render(EmailTemplate.NEWSLETTER_CAMPAIGN, {
      ...input,
      sections: sections.map(({ id: _id, sortOrder: _sortOrder, ...section }) => section),
      testMode: true,
    });
    return createSuccessResponse(rendered);
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    return createErrorResponse(
      'NEWSLETTER_PREVIEW_FAILED',
      'プレビューを生成できませんでした。',
      500,
    );
  }
};
