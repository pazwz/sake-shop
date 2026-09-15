import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { CustomerAuthService } from '@/services/customer-auth.service';
import { requireCustomer } from '@/services/customer-authorization.service';
import { customerProfileValidator } from '@/validators/customer-account.validator';

export const PATCH = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const customer = await requireCustomer();
    const input = customerProfileValidator.parse(await request.json());
    return createSuccessResponse(
      await new CustomerAuthService().updateProfile(customer.id, input.name),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'PROFILE_UPDATE_FAILED',
      '会員情報を更新できませんでした。',
      500,
    );
  }
};
