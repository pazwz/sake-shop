import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { PaymentService } from '@/services/payment.service';
import { paymentCreateValidator } from '@/validators/payment.validator';
import { requireCustomer } from '@/services/customer-authorization.service';
import { assertSameOriginMutation } from '@/lib/request-security';
import { CheckoutAccessService } from '@/services/checkout-access.service';

const service = new PaymentService();
const checkoutAccess = new CheckoutAccessService();

export const POST = async (request: Request) => {
  try {
    checkoutAccess.assertMockPaymentAllowed();
    assertSameOriginMutation(request);
    const customer = await requireCustomer();
    return createSuccessResponse(
      await service.create(
        paymentCreateValidator.parse(await request.json()),
        customer.id,
      ),
      201,
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to create payment.',
      500,
    );
  }
};
