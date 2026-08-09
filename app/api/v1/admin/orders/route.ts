import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { OrderService } from '@/services/order.service';
import { adminOrderQueryValidator } from '@/validators/order.validator';
const service = new OrderService();
export const GET = async (request: Request) => {
  try {
    await requireAdmin();
    return createSuccessResponse(
      await service.getAdminOrders(
        adminOrderQueryValidator.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        ),
      ),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to load orders.',
      500,
    );
  }
};
