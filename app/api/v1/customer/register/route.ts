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
import { AppError, ValidationError } from '@/lib/errors';
import {
  assertSameOriginMutation,
  getRequestAttemptKey,
} from '@/lib/request-security';
import { CustomerAuthService } from '@/services/customer-auth.service';
import { customerRegisterValidator } from '@/validators/customer-auth.validator';
import {
  createServerRequestId,
  logSafeServerError,
} from '@/lib/server-error-logger';

const service = new CustomerAuthService();

export const POST = async (request: Request) => {
  let attemptKey: string | null = null;
  const requestId = createServerRequestId();
  try {
    assertSameOriginMutation(request);
    const input = customerRegisterValidator.parse(await request.json());
    attemptKey = getRequestAttemptKey(request, input.email);
    if (!canAttemptCustomerAuth('register', attemptKey)) {
      return createErrorResponse(
        'REGISTER_RATE_LIMITED',
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
    const result = await service.register(input, previousToken);
    clearCustomerAuthFailures('register', attemptKey);
    const response = createSuccessResponse(result.customer, 201);
    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      result.token,
      customerSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    if (attemptKey) recordCustomerAuthFailure('register', attemptKey);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    logSafeServerError({
      route: '/api/v1/customer/register',
      requestId,
      error,
    });
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      '会員登録に失敗しました。',
      500,
    );
  }
};
