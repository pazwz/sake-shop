import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { AdminProductService } from '@/services/admin-product.service';
import { requireAdmin } from '@/services/admin-authorization.service';
import { adminProductQueryValidator } from '@/validators/admin-product.validator';

const service = new AdminProductService();

export const GET = async (request: Request) => {
  try {
    await requireAdmin();
    const query = adminProductQueryValidator.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return createSuccessResponse(await service.getProducts(query));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    return createErrorResponse(
      'ADMIN_PRODUCTS_FAILED',
      '商品一覧を取得できませんでした。',
      500,
    );
  }
};
