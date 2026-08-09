import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { FeaturedCollectionService } from '@/services/collection.service';
import { collectionProductOrderValidator } from '@/validators/collection.validator';

const collectionService = new FeaturedCollectionService();

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const { productIds } = collectionProductOrderValidator.parse(
      await request.json(),
    );
    return createSuccessResponse(
      await collectionService.updateProductOrder(id, productIds),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to reorder products.',
      500,
    );
  }
};
