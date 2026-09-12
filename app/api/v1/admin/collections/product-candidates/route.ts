import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { FeaturedCollectionService } from '@/services/collection.service';
import { requireAdmin } from '@/services/admin-authorization.service';
import { collectionProductCandidateQueryValidator } from '@/validators/collection.validator';

const collectionService = new FeaturedCollectionService();

export const GET = async (request: Request) => {
  try {
    await requireAdmin();
    const query = collectionProductCandidateQueryValidator.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return createSuccessResponse(
      await collectionService.getAdminCollectionProductCandidates(query),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError) {
      return createAppErrorResponse(new ValidationError());
    }
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to load collection product candidates.',
      500,
    );
  }
};
