import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { OperationsHealthService } from '@/services/operations-health.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = async () => {
  try {
    await requireAdmin();
    return createSuccessResponse(
      await new OperationsHealthService().getHealth(),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'OPERATIONS_HEALTH_FAILED',
      '運用状態を取得できませんでした。',
      500,
    );
  }
};
