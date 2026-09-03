import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { ProductionSmaregiSyncService } from '@/services/smaregi/production-smaregi-sync.service';
import { assertCronAuthorization } from '@/services/smaregi/smaregi-sync-access.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export const GET = async (request: Request) => {
  try {
    assertCronAuthorization(request.headers.get('authorization'));
    return createSuccessResponse(
      await new ProductionSmaregiSyncService().run('CRON'),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'SMAREGI_PRODUCTION_SYNC_FAILED',
      'スマレジ同期に失敗しました。',
      500,
    );
  }
};
