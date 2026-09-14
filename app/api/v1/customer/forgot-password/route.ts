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
import { CustomerAuthService } from '@/services/customer-auth.service';
import { forgotPasswordValidator } from '@/validators/customer-auth.validator';

const generic = {
  message: 'ご登録のメールアドレスであれば、再設定メールを送信します。',
};

export const POST = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const input = forgotPasswordValidator.parse(await request.json());
    const key = getRequestAttemptKey(request, input.email);
    if (!canAttemptCustomerAuth('forgot-password', key))
      return createSuccessResponse(generic);
    recordCustomerAuthFailure('forgot-password', key);
    await new CustomerAuthService().requestPasswordReset(input.email);
    return createSuccessResponse(generic);
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'PASSWORD_RESET_REQUEST_FAILED',
      generic.message,
      500,
    );
  }
};
