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
import { FeaturedCollectionService } from '@/services/collection.service';
import { editorialOrderValidator } from '@/validators/collection.validator';

const collectionService = new FeaturedCollectionService();

export const PATCH = async (request: Request) => {
  try {
    await requireAdmin(cmsAdminRoles);
    const { collectionIds } = editorialOrderValidator.parse(
      await request.json(),
    );
    await collectionService.updateEditorialOrder(collectionIds);
    return createSuccessResponse({ collectionIds });
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError) {
      return createAppErrorResponse(new ValidationError());
    }
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to reorder editorial collections.',
      500,
    );
  }
};
