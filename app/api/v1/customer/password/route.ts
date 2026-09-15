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
import { requireCustomer } from '@/services/customer-authorization.service';
import { verifiedChangePasswordValidator } from '@/validators/customer-auth.validator';

export const PATCH = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const customer = await requireCustomer();
    const input = verifiedChangePasswordValidator.parse(await request.json());
    const result = await new CustomerAuthService().changePassword(
      customer.id,
      input.currentPassword,
      input.newPassword,
    );
    const response = createSuccessResponse({ changed: result.changed });
    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      result.token,
      customerSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'PASSWORD_CHANGE_FAILED',
      'パスワードを変更できませんでした。',
      500,
    );
  }
};
