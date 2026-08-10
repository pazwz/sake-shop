import { AdminRole } from '@prisma/client';
import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { SmaregiInventorySyncService } from '@/services/smaregi/smaregi-inventory-sync.service';
import { smaregiFullSyncValidator } from '@/validators/smaregi.validator';

const service = new SmaregiInventorySyncService();

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
      'SMAREGI_INVENTORY_SYNC_FAILED',
      'Unable to synchronize Smaregi inventory.',
      500,
    );
  }
};
