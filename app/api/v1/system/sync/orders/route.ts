import { AdminRole } from '@prisma/client';
import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { SmaregiOrderService } from '@/services/smaregi/smaregi-order.service';
import { smaregiOrderSyncValidator } from '@/validators/smaregi.validator';

const service = new SmaregiOrderService();

export const POST = async (request: Request) => {
  try {
    await requireAdmin([AdminRole.OWNER]);
    const { orderId } = smaregiOrderSyncValidator.parse(await request.json());
    return createSuccessResponse(await service.sync(orderId));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'SMAREGI_ORDER_SYNC_FAILED',
      'Unable to synchronize the order to Smaregi.',
      500,
    );
  }
};
