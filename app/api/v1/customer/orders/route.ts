import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { CustomerOrderAccessService } from '@/services/customer-order-access.service';

const service = new CustomerOrderAccessService();

export const GET = async (request: Request) => {
  try {
    const requested = Number(
      new URL(request.url).searchParams.get('page') ?? '1',
    );
    return createSuccessResponse(
      await service.getOrderPage(Number.isFinite(requested) ? requested : 1),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to load orders.',
      500,
    );
  }
};
