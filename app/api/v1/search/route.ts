import {
  INTERNAL_SERVER_ERROR_CODE,
  INTERNAL_SERVER_ERROR_MESSAGE,
} from '@/config/api';
import { AppError, ValidationError } from '@/lib/errors';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { ProductService } from '@/services/product.service';
import { searchQueryValidator } from '@/validators/product.validator';
import { ZodError } from 'zod';

const productService = new ProductService();

export const GET = async (request: Request) => {
  try {
    const query = searchQueryValidator.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    return createSuccessResponse(
      await productService.searchProducts(query.keyword, query),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError) {
      return createAppErrorResponse(new ValidationError());
    }

    return createErrorResponse(
      INTERNAL_SERVER_ERROR_CODE,
      INTERNAL_SERVER_ERROR_MESSAGE,
      500,
    );
  }
};
