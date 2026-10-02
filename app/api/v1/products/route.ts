import { AppError, ValidationError } from '@/lib/errors';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { ProductService } from '@/services/product.service';
import { createServerRequestId } from '@/lib/server-error-logger';
import { logProductPrismaError } from '@/lib/product-error-logger';
import { productQueryValidator } from '@/validators/product.validator';
import { ZodError } from 'zod';
import {
  INTERNAL_SERVER_ERROR_CODE,
  INTERNAL_SERVER_ERROR_MESSAGE,
} from '@/config/api';

const productService = new ProductService();

export const GET = async (request: Request) => {
  const requestId = createServerRequestId();
  const started = performance.now();
  try {
    const query = productQueryValidator.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    return createSuccessResponse(await productService.getProducts(query));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError) {
      return createAppErrorResponse(new ValidationError());
    }

    logProductPrismaError({
      error,
      route: '/api/v1/products',
      requestId,
      elapsed: performance.now() - started,
    });

    return createErrorResponse(
      INTERNAL_SERVER_ERROR_CODE,
      INTERNAL_SERVER_ERROR_MESSAGE,
      500,
    );
  }
};
