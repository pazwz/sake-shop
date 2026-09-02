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
import { adminProductImageValidator } from '@/validators/admin-product.validator';

const service = new AdminProductService();

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin(cmsAdminRoles);
    const { id } = await params;
    const input = adminProductImageValidator.parse(await request.json());
    return createSuccessResponse(await service.addImage(id, input), 201);
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    return createErrorResponse(
      'PRODUCT_IMAGE_CREATE_FAILED',
      '商品画像を登録できませんでした。',
      500,
    );
  }
};
