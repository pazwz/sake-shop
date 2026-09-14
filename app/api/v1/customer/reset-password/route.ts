import { ZodError } from 'zod';
import {
  CUSTOMER_SESSION_COOKIE,
  customerSessionCookieOptions,
} from '@/config/customer-auth';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { CustomerAuthService } from '@/services/customer-auth.service';
import { resetPasswordValidator } from '@/validators/customer-auth.validator';

export const POST = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const input = resetPasswordValidator.parse(await request.json());
    const response = createSuccessResponse(
      await new CustomerAuthService().resetPassword(
        input.token,
        input.password,
      ),
    );
    response.cookies.set(CUSTOMER_SESSION_COOKIE, '', {
      ...customerSessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'PASSWORD_RESET_FAILED',
      'パスワードを再設定できませんでした。',
      500,
    );
  }
};
