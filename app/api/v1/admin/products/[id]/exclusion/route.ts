import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import {
  cmsAdminRoles,
  requireAdmin,
} from '@/services/admin-authorization.service';
import { SmaregiProductExclusionService } from '@/services/smaregi-product-exclusion.service';

const service = new SmaregiProductExclusionService();

export const POST = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const admin = await requireAdmin(cmsAdminRoles);
    const { id } = await params;
    return createSuccessResponse(await service.excludeProduct(id, admin.id));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'SMAREGI_PRODUCT_EXCLUSION_FAILED',
      'EC販売対象から除外できませんでした。',
      500,
    );
  }
};
