import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { FeaturedCollectionService } from '@/services/collection.service';
import { collectionInputValidator } from '@/validators/collection.validator';

const collectionService = new FeaturedCollectionService();

const handleError = (error: unknown) => {
  if (error instanceof AppError) return createAppErrorResponse(error);
  if (error instanceof ZodError)
    return createAppErrorResponse(new ValidationError());
  return createErrorResponse(
    'INTERNAL_SERVER_ERROR',
    'Unable to manage collections.',
    500,
  );
};

export const GET = async () => {
  try {
    return createSuccessResponse(await collectionService.getAdminCollections());
  } catch (error) {
    return handleError(error);
  }
};

export const POST = async (request: Request) => {
  try {
    const input = collectionInputValidator.parse(await request.json());
    return createSuccessResponse(
      await collectionService.createCollection(input),
      201,
    );
  } catch (error) {
    return handleError(error);
  }
};
