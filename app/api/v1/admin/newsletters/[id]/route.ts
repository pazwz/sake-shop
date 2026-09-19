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
import { newsletterCampaignUpdateValidator } from '@/validators/newsletter-campaign.validator';

const service = new NewsletterCampaignService();

const handleError = (error: unknown) => {
  if (error instanceof AppError) return createAppErrorResponse(error);
  if (error instanceof ZodError)
    return createAppErrorResponse(
      new ValidationError(error.issues[0]?.message),
    );
  return createErrorResponse(
    'NEWSLETTER_CAMPAIGN_FAILED',
    'ニュースレターを処理できませんでした。',
    500,
  );
};

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin();
    return createSuccessResponse(await service.get((await params).id));
  } catch (error) {
    return handleError(error);
  }
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const admin = await requireAdmin(cmsAdminRoles);
    const input = newsletterCampaignUpdateValidator.parse(await request.json());
    return createSuccessResponse(
      await service.update((await params).id, input, admin.id),
    );
  } catch (error) {
    return handleError(error);
  }
};
