import {
  createAppErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { FeaturedCollectionService } from '@/services/collection.service';

const collectionService = new FeaturedCollectionService();
export const GET = async () => {
  try {
    return createSuccessResponse(await collectionService.getHome());
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);

    return createAppErrorResponse(
      new AppError(
        'Unable to load home collections.',
        'HOME_FETCH_FAILED',
        500,
      ),
    );
  }
};
