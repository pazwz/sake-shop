import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { CustomerAuthService } from '@/services/customer-auth.service';
import { verifyEmailValidator } from '@/validators/customer-auth.validator';

export const POST = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const input = verifyEmailValidator.parse(await request.json());
    return createSuccessResponse(
      await new CustomerAuthService().verifyEmail(input.token),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'EMAIL_VERIFICATION_FAILED',
      'メールアドレスを確認できませんでした。',
      500,
    );
  }
};
