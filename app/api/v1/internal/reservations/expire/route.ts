import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { InventoryReservationService } from '@/services/inventory-reservation.service';
import { assertCronAuthorization } from '@/services/smaregi/smaregi-sync-access.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = async (request: Request) => {
  try {
    assertCronAuthorization(request.headers.get('authorization'));
    return createSuccessResponse(
      await new InventoryReservationService().expireDue(),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'RESERVATION_EXPIRATION_FAILED',
      '予約在庫の期限処理に失敗しました。',
      500,
    );
  }
};
