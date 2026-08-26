import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionToken,
} from '@/lib/admin-session';
import {
  canAttemptAdminLogin,
  clearAdminLoginAttempts,
  recordFailedAdminLogin,
} from '@/lib/admin-login-rate-limit';
import { AppError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { AdminService } from '@/services/admin.service';
import { adminLoginValidator } from '@/validators/admin-auth.validator';

const adminService = new AdminService();

const getAttemptKey = (request: Request, identifier: string) =>
  `${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}:${identifier.toLowerCase()}`;

export const POST = async (request: Request) => {
  let attemptKey: string | null = null;
  try {
    const input = adminLoginValidator.parse(await request.json());
    attemptKey = getAttemptKey(request, input.username);
    if (!canAttemptAdminLogin(attemptKey)) {
      return createErrorResponse(
        'LOGIN_RATE_LIMITED',
        'Too many login attempts. Try again later.',
        429,
      );
    }
    const admin = await adminService.authenticate(
      input.username,
      input.password,
    );
    clearAdminLoginAttempts(attemptKey);
    const response = createSuccessResponse({
      id: admin.id,
      name: admin.name,
      role: admin.role,
    });
    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      await createAdminSessionToken({ adminId: admin.id, role: admin.role }),
      adminSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      if (attemptKey) recordFailedAdminLogin(attemptKey);
      return createAppErrorResponse(error);
    }
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to sign in.',
      500,
    );
  }
};
