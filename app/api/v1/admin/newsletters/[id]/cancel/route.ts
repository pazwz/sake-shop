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
      await service.cancel((await params).id, admin.id),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'NEWSLETTER_CANCEL_FAILED',
      '配信予約をキャンセルできませんでした。',
      500,
    );
  }
};
