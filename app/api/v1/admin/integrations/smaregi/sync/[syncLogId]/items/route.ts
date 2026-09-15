import { ZodError, z } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { SmaregiSyncDetailService } from '@/services/smaregi/smaregi-sync-detail.service';
import { SMAREGI_SYNC_ADMIN_ROLES } from '@/services/smaregi/smaregi-sync-access.service';

const service = new SmaregiSyncDetailService();
const queryValidator = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ syncLogId: string }> },
) => {
  try {
    await requireAdmin([...SMAREGI_SYNC_ADMIN_ROLES]);
    const { syncLogId } = await params;
    const query = queryValidator.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return createSuccessResponse(
      await service.getItems(syncLogId, query.page, query.limit),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(
        new ValidationError(error.issues[0]?.message),
      );
    return createErrorResponse(
      'SMAREGI_SYNC_DETAIL_FAILED',
      '同期明細を取得できませんでした。',
      500,
    );
  }
};
