import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { OrderService } from '@/services/order.service';
import { orderValidator } from '@/validators/order.validator';
const service = new OrderService();
export const POST = async (request: Request) => {
  try {
    const body = await request.json();
    if (body.ageConfirmed !== true) {
      throw new AppError(
        'Age confirmation is required to order alcohol.',
        'AGE_CONFIRMATION_REQUIRED',
        422,
      );
    }
    return createSuccessResponse(
      await service.create(orderValidator.parse(body)),
      201,
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to create order.',
      500,
    );
  }
};
