import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { PaymentService } from '@/services/payment.service';
import { paymentWebhookValidator } from '@/validators/payment.validator';

const service = new PaymentService();

export const POST = async (request: Request) => {
  try {
    return createSuccessResponse(
      await service.handleWebhook(
        paymentWebhookValidator.parse(await request.json()),
        request.headers.get('x-payment-signature'),
      ),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to process payment webhook.',
      500,
    );
  }
};
