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
import { newsletterCampaignScheduleValidator } from '@/validators/newsletter-campaign.validator';

const service = new NewsletterCampaignService();

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const admin = await requireAdmin(cmsAdminRoles);
    const input = newsletterCampaignScheduleValidator.parse(
      await request.json(),
    );
    return createSuccessResponse(
      await service.schedule(
        (await params).id,
        new Date(input.scheduledAt),
        admin.id,
      ),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    return createErrorResponse(
      'NEWSLETTER_SCHEDULE_FAILED',
      '配信予約を設定できませんでした。',
      500,
    );
  }
};
