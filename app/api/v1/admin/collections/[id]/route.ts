import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { FeaturedCollectionService } from '@/services/collection.service';
import {
  cmsAdminRoles,
  requireAdmin,
} from '@/services/admin-authorization.service';
import { collectionUpdateValidator } from '@/validators/collection.validator';

const collectionService = new FeaturedCollectionService();
const handleError = (error: unknown) => {
  if (error instanceof AppError) return createAppErrorResponse(error);
  if (error instanceof ZodError)
    return createAppErrorResponse(new ValidationError());
  return createErrorResponse(
    'INTERNAL_SERVER_ERROR',
    'Unable to manage collection.',
    500,
  );
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin(cmsAdminRoles);
    const { id } = await params;
    const input = collectionUpdateValidator.parse(await request.json());
    return createSuccessResponse(
      await collectionService.updateCollection(id, input),
    );
  } catch (error) {
    return handleError(error);
  }
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin(cmsAdminRoles);
    const { id } = await params;
    await collectionService.deleteCollection(id);
    return createSuccessResponse({ id });
  } catch (error) {
    return handleError(error);
  }
};
