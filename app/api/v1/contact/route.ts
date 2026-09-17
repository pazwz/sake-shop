import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import {
  canAttemptCustomerAuth,
  recordCustomerAuthFailure,
} from '@/lib/customer-auth-rate-limit';
import {
  assertSameOriginMutation,
  getRequestAttemptKey,
} from '@/lib/request-security';
import { getCurrentCustomer } from '@/services/customer-authorization.service';
import { ContactService } from '@/services/contact.service';
import { contactSubmitValidator } from '@/validators/contact.validator';

const service = new ContactService();

export const POST = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const input = contactSubmitValidator.parse(await request.json());
    const key = getRequestAttemptKey(request, input.email);
    if (!canAttemptCustomerAuth('contact', key))
      return createErrorResponse(
        'CONTACT_RATE_LIMITED',
        'しばらく待ってからもう一度お試しください。',
        429,
      );
    recordCustomerAuthFailure('contact', key);
    const customer = await getCurrentCustomer();
    return createSuccessResponse(
      await service.submit(input, customer?.id),
      201,
    );
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError)
      return createErrorResponse(
        'VALIDATION_ERROR',
        '入力内容を確認してください。',
        400,
      );
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'CONTACT_SUBMISSION_FAILED',
      '送信できませんでした。時間をおいて再度お試しください。',
      500,
    );
  }
};
