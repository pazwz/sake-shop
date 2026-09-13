import {
  createAppErrorResponse,
  createErrorResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { CustomerOrderAccessService } from '@/services/customer-order-access.service';

const service = new CustomerOrderAccessService();

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) => {
  try {
    return await service.getOrderDetail((await params).orderNumber);
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to load order.',
      500,
    );
  }
};
