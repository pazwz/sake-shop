import { ZodError } from 'zod';
import {
  canAttemptCustomerAuth,
  recordCustomerAuthFailure,
} from '@/lib/customer-auth-rate-limit';
import {
  createAppErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import {
  assertSameOriginMutation,
  getRequestAttemptKey,
} from '@/lib/request-security';
import { CustomerAuthService } from '@/services/customer-auth.service';
import { verificationResendValidator } from '@/validators/customer-auth.validator';

const generic = {
  message:
    '未確認のメールアドレスであれば、確認メールを再送します。しばらくお待ちください。',
};

export const POST = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const input = verificationResendValidator.parse(await request.json());
    const key = getRequestAttemptKey(request, input.email);
    if (!canAttemptCustomerAuth('verification-resend', key))
      return createSuccessResponse(generic);
    recordCustomerAuthFailure('verification-resend', key);
    await new CustomerAuthService().resendVerification(input.email);
    return createSuccessResponse(generic);
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createSuccessResponse(generic);
  }
};
