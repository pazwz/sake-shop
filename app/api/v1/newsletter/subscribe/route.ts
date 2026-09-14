import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import {
  canAttemptCustomerAuth,
  recordCustomerAuthFailure,
} from '@/lib/customer-auth-rate-limit';
import {
  assertSameOriginMutation,
  getRequestAttemptKey,
} from '@/lib/request-security';
import { NewsletterService } from '@/services/newsletter.service';
import { newsletterSubscribeValidator } from '@/validators/newsletter.validator';

export const POST = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const input = newsletterSubscribeValidator.parse(await request.json());
    const key = getRequestAttemptKey(request, input.email);
    if (!canAttemptCustomerAuth('newsletter', key))
      return createErrorResponse(
        'NEWSLETTER_RATE_LIMITED',
        'しばらく待ってからもう一度お試しください。',
        429,
      );
    recordCustomerAuthFailure('newsletter', key);
    return createSuccessResponse(
      await new NewsletterService().subscribe(input.email),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'NEWSLETTER_SUBSCRIBE_FAILED',
      '登録に失敗しました。',
      500,
    );
  }
};
