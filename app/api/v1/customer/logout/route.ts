import {
  CUSTOMER_SESSION_COOKIE,
  customerSessionCookieOptions,
} from '@/config/customer-auth';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { CustomerAuthService } from '@/services/customer-auth.service';

const service = new CustomerAuthService();

export const POST = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const token = request.headers
      .get('cookie')
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${CUSTOMER_SESSION_COOKIE}=`))
      ?.slice(CUSTOMER_SESSION_COOKIE.length + 1);
    await service.logout(token);
    const response = createSuccessResponse({ loggedOut: true });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, '', {
      ...customerSessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'ログアウトに失敗しました。',
      500,
    );
  }
};
