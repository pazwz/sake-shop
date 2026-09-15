import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import {
  cmsAdminRoles,
  requireAdmin,
} from '@/services/admin-authorization.service';
import { SmaregiProductExclusionService } from '@/services/smaregi-product-exclusion.service';
import { smaregiProductExclusionRevokeValidator } from '@/validators/smaregi-product-exclusion.validator';

const service = new SmaregiProductExclusionService();

const handleError = (error: unknown) => {
  if (error instanceof AppError) return createAppErrorResponse(error);
  if (error instanceof ZodError)
    return createAppErrorResponse(
      new ValidationError(error.issues[0]?.message),
    );
  return createErrorResponse(
    'SMAREGI_PRODUCT_EXCLUSION_FAILED',
    'EC販売対象外の設定を処理できませんでした。',
    500,
  );
};

export const GET = async () => {
  try {
    await requireAdmin(cmsAdminRoles);
    return createSuccessResponse(await service.listActive());
  } catch (error) {
    return handleError(error);
  }
};

export const DELETE = async (request: Request) => {
  try {
    await requireAdmin(cmsAdminRoles);
    const { smaregiProductId } = smaregiProductExclusionRevokeValidator.parse(
      await request.json(),
    );
    return createSuccessResponse(await service.revoke(smaregiProductId));
  } catch (error) {
    return handleError(error);
  }
};
