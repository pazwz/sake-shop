import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import {
  cmsAdminRoles,
  requireAdmin,
} from '@/services/admin-authorization.service';
import { NewsletterCampaignService } from '@/services/newsletter-campaign.service';
import { newsletterCampaignSectionsValidator } from '@/validators/newsletter-campaign.validator';

const service = new NewsletterCampaignService();

export const PUT = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const admin = await requireAdmin(cmsAdminRoles);
    const input = newsletterCampaignSectionsValidator.parse(
      await request.json(),
    );
    return createSuccessResponse(
      await service.replaceSections((await params).id, input, admin.id),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    return createErrorResponse(
      'NEWSLETTER_SECTIONS_FAILED',
      '追加コンテンツを保存できませんでした。',
      500,
    );
  }
};
