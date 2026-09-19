import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import {
  cmsAdminRoles,
  requireAdmin,
} from '@/services/admin-authorization.service';
import { NewsletterCampaignService } from '@/services/newsletter-campaign.service';

const service = new NewsletterCampaignService();

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const admin = await requireAdmin(cmsAdminRoles);
    return createSuccessResponse(
      await service.copyAsDraft((await params).id, admin.id),
      201,
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'NEWSLETTER_CAMPAIGN_COPY_FAILED',
      'ニュースレターを複製できませんでした。',
      500,
    );
  }
};
