import { ZodError } from 'zod';
import {
  CUSTOMER_SESSION_COOKIE,
  customerSessionCookieOptions,
} from '@/config/customer-auth';
import {
  canAttemptCustomerAuth,
  clearCustomerAuthFailures,
  recordCustomerAuthFailure,
} from '@/lib/customer-auth-rate-limit';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, UnauthorizedError, ValidationError } from '@/lib/errors';
import {
  assertSameOriginMutation,
  getRequestAttemptKey,
} from '@/lib/request-security';
import { CustomerAuthService } from '@/services/customer-auth.service';
import { customerLoginValidator } from '@/validators/customer-auth.validator';

const service = new CustomerAuthService();

export const POST = async (request: Request) => {
  let attemptKey: string | null = null;
  try {
    assertSameOriginMutation(request);
    const input = customerLoginValidator.parse(await request.json());
    attemptKey = getRequestAttemptKey(request, input.email);
    if (!canAttemptCustomerAuth('login', attemptKey)) {
      return createErrorResponse(
        'LOGIN_RATE_LIMITED',
        'しばらく待ってからもう一度お試しください。',
        429,
      );
    }
    const previousToken = request.headers
      .get('cookie')
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${CUSTOMER_SESSION_COOKIE}=`))
      ?.slice(CUSTOMER_SESSION_COOKIE.length + 1);
    const result = await service.login(input, previousToken);
    clearCustomerAuthFailures('login', attemptKey);
    const response = createSuccessResponse(result.customer);
    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      result.token,
      customerSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    if (attemptKey && error instanceof UnauthorizedError)
      recordCustomerAuthFailure('login', attemptKey);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'ログインに失敗しました。',
      500,
    );
  }
};
