import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { AdminProductService } from '@/services/admin-product.service';
import {
  cmsAdminRoles,
  requireAdmin,
} from '@/services/admin-authorization.service';
import { adminProductImageOrderValidator } from '@/validators/admin-product.validator';

const service = new AdminProductService();

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin(cmsAdminRoles);
    const { id } = await params;
    const { imageIds } = adminProductImageOrderValidator.parse(
      await request.json(),
    );
    return createSuccessResponse(await service.reorderImages(id, imageIds));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    return createErrorResponse(
      'PRODUCT_IMAGE_ORDER_FAILED',
      '商品画像の順序を更新できませんでした。',
      500,
    );
  }
};
