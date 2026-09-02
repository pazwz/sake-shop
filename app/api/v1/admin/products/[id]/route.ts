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
import { adminProductUpdateValidator } from '@/validators/admin-product.validator';

const service = new AdminProductService();

const handleError = (error: unknown) => {
  if (error instanceof AppError) return createAppErrorResponse(error);
  if (error instanceof ZodError)
    return createAppErrorResponse(
      new ValidationError(error.issues[0]?.message),
    );
  return createErrorResponse(
    'ADMIN_PRODUCT_FAILED',
    '商品情報を処理できませんでした。',
    500,
  );
};

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin();
    const { id } = await params;
    return createSuccessResponse(await service.getProduct(id));
  } catch (error) {
    return handleError(error);
  }
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin(cmsAdminRoles);
    const { id } = await params;
    const input = adminProductUpdateValidator.parse(await request.json());
    return createSuccessResponse(await service.updateProduct(id, input));
  } catch (error) {
    return handleError(error);
  }
};
