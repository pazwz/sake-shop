import {
  INTERNAL_SERVER_ERROR_CODE,
  INTERNAL_SERVER_ERROR_MESSAGE,
} from '@/config/api';
import { AppError } from '@/lib/errors';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { ProductService } from '@/services/product.service';

const productService = new ProductService();

export const GET = async (
  _request: Request,
  context: { params: Promise<{ identifier: string }> },
) => {
  try {
    const { identifier } = await context.params;

    return createSuccessResponse(await productService.getProduct(identifier));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);

    return createErrorResponse(
      INTERNAL_SERVER_ERROR_CODE,
      INTERNAL_SERVER_ERROR_MESSAGE,
      500,
    );
  }
};
