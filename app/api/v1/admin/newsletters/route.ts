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
import { newsletterCampaignCreateValidator } from '@/validators/newsletter-campaign.validator';

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

export const GET = async () => {
  try {
    await requireAdmin();
    const [campaigns, currentRecipientEstimate] = await Promise.all([
      service.list(),
      service.currentRecipientEstimate(),
    ]);
    return createSuccessResponse({ campaigns, currentRecipientEstimate });
  } catch (error) {
    return handleError(error);
  }
};

export const POST = async (request: Request) => {
  try {
    const admin = await requireAdmin(cmsAdminRoles);
    const input = newsletterCampaignCreateValidator.parse(await request.json());
    return createSuccessResponse(await service.create(input, admin.id), 201);
  } catch (error) {
    return handleError(error);
  }
};
