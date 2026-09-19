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
import { newsletterCampaignCreateValidator } from '@/validators/newsletter-campaign.validator';

const templates = new EmailTemplateService();

export const POST = async (request: Request) => {
  try {
    await requireAdmin();
    const input = newsletterCampaignCreateValidator.parse(await request.json());
    const rendered = templates.render(EmailTemplate.NEWSLETTER_CAMPAIGN, {
      ...input,
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
