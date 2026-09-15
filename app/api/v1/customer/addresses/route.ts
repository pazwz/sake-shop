import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { CustomerAddressService } from '@/services/customer-address.service';
import { requireCustomer } from '@/services/customer-authorization.service';
import { customerAddressValidator } from '@/validators/customer-account.validator';

const service = new CustomerAddressService();

export const GET = async () => {
  try {
    const customer = await requireCustomer();
    return createSuccessResponse(await service.list(customer.id));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'ADDRESS_LIST_FAILED',
      'お届け先を取得できませんでした。',
      500,
    );
  }
};

export const POST = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const customer = await requireCustomer();
    const input = customerAddressValidator.parse(await request.json());
    return createSuccessResponse(await service.create(customer.id, input), 201);
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'ADDRESS_CREATE_FAILED',
      'お届け先を登録できませんでした。',
      500,
    );
  }
};
