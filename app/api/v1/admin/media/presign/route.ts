import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import {
  cmsAdminRoles,
  requireAdmin,
} from '@/services/admin-authorization.service';
import { MediaService } from '@/services/media.service';
import { adminMediaPresignValidator } from '@/validators/admin-media.validator';

export const runtime = 'nodejs';

const mediaService = new MediaService();

export const POST = async (request: Request) => {
  try {
    await requireAdmin(cmsAdminRoles);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Invalid JSON payload.');
    }
    const input = adminMediaPresignValidator.parse(body);

    return createSuccessResponse(
      await mediaService.createPresignedImageUpload(input),
      201,
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError) {
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    }
    return createErrorResponse(
      'MEDIA_PRESIGN_FAILED',
      'Unable to prepare media upload.',
      500,
    );
  }
};
