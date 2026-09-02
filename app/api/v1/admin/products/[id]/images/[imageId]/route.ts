import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { AdminProductService } from '@/services/admin-product.service';
import {
  cmsAdminRoles,
  requireAdmin,
} from '@/services/admin-authorization.service';

const service = new AdminProductService();

export const DELETE = async (
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; imageId: string }>;
  },
) => {
  try {
    await requireAdmin(cmsAdminRoles);
    const { id, imageId } = await params;
    return createSuccessResponse(await service.deleteImage(id, imageId));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'PRODUCT_IMAGE_DELETE_FAILED',
      '商品画像を削除できませんでした。',
      500,
    );
  }
};
