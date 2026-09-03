import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { ProductionSmaregiSyncService } from '@/services/smaregi/production-smaregi-sync.service';
import {
  assertSmaregiSyncAdminRole,
  requireAvailableManualSync,
  SMAREGI_SYNC_ADMIN_ROLES,
} from '@/services/smaregi/smaregi-sync-access.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = async () => {
  try {
    const admin = await requireAdmin([...SMAREGI_SYNC_ADMIN_ROLES]);
    assertSmaregiSyncAdminRole(admin.role);
    const result = requireAvailableManualSync(
      await new ProductionSmaregiSyncService().run('ADMIN'),
    );
    return createSuccessResponse(result);
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'SMAREGI_PRODUCTION_SYNC_FAILED',
      'スマレジ同期に失敗しました。',
      500,
    );
  }
};
