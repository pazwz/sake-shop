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
import { adminMediaFileValidator } from '@/validators/admin-media.validator';

export const runtime = 'nodejs';

const mediaService = new MediaService();

export const POST = async (request: Request) => {
  try {
    await requireAdmin(cmsAdminRoles);

    const contentType = request.headers.get('content-type');
    if (!contentType?.toLowerCase().startsWith('multipart/form-data')) {
      throw new ValidationError('multipart/form-data is required.');
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ValidationError('Invalid multipart/form-data payload.');
    }
    const file = adminMediaFileValidator.parse(
      formData.get('file') ?? formData.get('image'),
    );

    return createSuccessResponse(await mediaService.uploadImage(file), 201);
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError) {
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    }
    return createErrorResponse(
      'MEDIA_UPLOAD_FAILED',
      'Unable to upload media.',
      500,
    );
  }
};
