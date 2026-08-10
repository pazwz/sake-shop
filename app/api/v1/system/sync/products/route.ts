import { AdminRole } from '@prisma/client';
import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { SmaregiProductSyncService } from '@/services/smaregi/smaregi-product-sync.service';
import { smaregiFullSyncValidator } from '@/validators/smaregi.validator';

const service = new SmaregiProductSyncService();

export const POST = async (request: Request) => {
  try {
    await requireAdmin([AdminRole.OWNER]);
    smaregiFullSyncValidator.parse(await request.json());
    return createSuccessResponse(await service.fullSync());
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'SMAREGI_PRODUCT_SYNC_FAILED',
      'Unable to synchronize Smaregi products.',
      500,
    );
  }
};
