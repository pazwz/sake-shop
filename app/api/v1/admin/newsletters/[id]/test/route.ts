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
import { newsletterCampaignTestValidator } from '@/validators/newsletter-campaign.validator';

const service = new NewsletterCampaignService();

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const admin = await requireAdmin(cmsAdminRoles);
    const input = newsletterCampaignTestValidator.parse(await request.json());
    return createSuccessResponse(
      await service.queueTest((await params).id, input.email, admin.id),
      202,
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    return createErrorResponse(
      'NEWSLETTER_TEST_FAILED',
      'テスト送信を準備できませんでした。',
      500,
    );
  }
};
