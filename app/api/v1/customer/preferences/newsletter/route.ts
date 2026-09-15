import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { requireCustomer } from '@/services/customer-authorization.service';
import { NewsletterService } from '@/services/newsletter.service';
import { customerNewsletterPreferenceValidator } from '@/validators/customer-account.validator';

const service = new NewsletterService();

export const GET = async () => {
  try {
    const customer = await requireCustomer();
    return createSuccessResponse(
      await service.getCustomerPreference(customer.email),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'NEWSLETTER_PREFERENCE_READ_FAILED',
      'メール配信設定を取得できませんでした。',
      500,
    );
  }
};

export const PATCH = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const customer = await requireCustomer();
    const input = customerNewsletterPreferenceValidator.parse(
      await request.json(),
    );
    return createSuccessResponse(
      await service.setCustomerPreference(customer.email, input.subscribed),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'NEWSLETTER_PREFERENCE_UPDATE_FAILED',
      'メール配信設定を更新できませんでした。',
      500,
    );
  }
};
