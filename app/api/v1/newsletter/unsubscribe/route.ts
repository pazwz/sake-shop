import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { NewsletterService } from '@/services/newsletter.service';
import { newsletterUnsubscribeValidator } from '@/validators/newsletter.validator';

export const POST = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const input = newsletterUnsubscribeValidator.parse(await request.json());
    return createSuccessResponse(
      await new NewsletterService().unsubscribe(input.token),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'NEWSLETTER_UNSUBSCRIBE_FAILED',
      '配信停止に失敗しました。',
      500,
    );
  }
};
