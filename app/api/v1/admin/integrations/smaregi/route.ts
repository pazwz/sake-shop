import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { requireDeveloper } from '@/services/admin-authorization.service';
import { SyncService } from '@/services/sync.service';

const service = new SyncService();

export const GET = async () => {
  try {
    await requireDeveloper();
    return createSuccessResponse(await service.getSmaregiStatus());
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'SMAREGI_STATUS_FAILED',
      'Unable to load Smaregi integration status.',
      500,
    );
  }
};
