import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { OrderService } from '@/services/order.service';
const service = new OrderService();
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) => {
  try {
    return createSuccessResponse(
      await service.getByOrderNumber((await params).orderNumber),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to load order.',
      500,
    );
  }
};
