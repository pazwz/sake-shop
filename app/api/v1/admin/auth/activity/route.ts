import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createAdminSessionToken, readAdminSessionToken } from '@/lib/admin-session';
import { createAppErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { AppError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { requireAdmin } from '@/services/admin-authorization.service';

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
    if (request.headers.get('origin') !== new URL(request.url).origin)
      throw new ForbiddenError('Request origin is required.');
    const session = await readAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
    if (!session) throw new UnauthorizedError();
    const admin = await requireAdmin();
    const response = createSuccessResponse({ active: true });
    response.cookies.set(ADMIN_SESSION_COOKIE,
      await createAdminSessionToken({ adminId: admin.id, role: admin.role }, session),
      { ...adminSessionCookieOptions(), maxAge: Math.max(0, session.expiresAt - Math.floor(Date.now() / 1000)) });
    return response;
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createAppErrorResponse(new UnauthorizedError());
  }
}
